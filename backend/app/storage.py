"""Cloud copies of media in Tigris (S3-compatible object storage).

Everything Braque writes under DATA_DIR (uploads and imported footage, thumbnails, renders) is
mirrored to the bucket under the same relative path, e.g. ``uploads/usr_x/ast_y.mp4``. The local
file stays as a working copy for ffmpeg; the bucket is the durable copy. Browsers load media
straight from the bucket through short-lived signed URLs (the bucket stays private, and Tigris
doesn't charge for downloads). If a local copy goes missing, ``ensure_local`` fetches it back.

Without TIGRIS_* settings everything stays on local disk, exactly as before.
"""

import asyncio
import logging
import mimetypes
import os
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional

from .config import DATA_DIR

log = logging.getLogger("braque.storage")

ACCESS_KEY = os.environ.get("TIGRIS_ACCESS_KEY_ID", "")
SECRET_KEY = os.environ.get("TIGRIS_SECRET_ACCESS_KEY", "")
BUCKET = os.environ.get("TIGRIS_BUCKET", "")
ENDPOINT = os.environ.get("TIGRIS_ENDPOINT", "https://t3.storage.dev")
# Tigris wants virtual-hosted URLs (bucket.t3.storage.dev); local S3 stand-ins need "path".
ADDRESSING = os.environ.get("TIGRIS_ADDRESSING", "virtual")
ENABLED = bool(ACCESS_KEY and SECRET_KEY and BUCKET)

URL_TTL = 6 * 3600  # signed URLs last 6 hours; redirects to them are cached for less (see api)

_background: set[asyncio.Task] = set()


@lru_cache(maxsize=1)
def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        region_name="auto",
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        config=Config(signature_version="s3v4", s3={"addressing_style": ADDRESSING},
                      retries={"max_attempts": 4, "mode": "standard"}),
    )


def key_for(path: str | Path) -> str:
    """Bucket key for a file under DATA_DIR: its path relative to DATA_DIR."""
    return Path(path).resolve().relative_to(DATA_DIR).as_posix()


async def put(path: str | Path) -> None:
    path = Path(path)
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    # upload_file switches to multipart for large files.
    await asyncio.to_thread(_client().upload_file, str(path), BUCKET, key_for(path),
                            ExtraArgs={"ContentType": ctype})


async def put_all(paths: Iterable[str | Path | None]) -> bool:
    """Upload every existing file; True if all made it."""
    if not ENABLED:
        return False
    try:
        for p in paths:
            if p and Path(p).exists():
                await put(p)
        return True
    except Exception:  # noqa: BLE001 - the local copy still works; a later sync can retry
        log.exception("upload to Tigris failed")
        return False


def signed_url(path: str | Path, filename: Optional[str] = None, download: bool = False,
               content_type: Optional[str] = None) -> str:
    params = {"Bucket": BUCKET, "Key": key_for(path)}
    if filename:
        safe = filename.replace('"', "")
        params["ResponseContentDisposition"] = f'{"attachment" if download else "inline"}; filename="{safe}"'
    if content_type:
        params["ResponseContentType"] = content_type
    return _client().generate_presigned_url("get_object", Params=params, ExpiresIn=URL_TTL)


async def ensure_local(path: str | Path | None) -> None:
    """Bring a file back from the bucket if the local working copy is missing."""
    if not path or not ENABLED or Path(path).exists():
        return
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    try:
        await asyncio.to_thread(_client().download_file, BUCKET, key_for(path), str(tmp))
        tmp.replace(path)
    except Exception:  # noqa: BLE001
        tmp.unlink(missing_ok=True)
        log.exception("could not restore %s from Tigris", path)


def delete_later(paths: Iterable[str | Path | None]) -> None:
    """Remove cloud copies in the background (missing keys are fine)."""
    keys = [key_for(p) for p in paths if p]
    if not ENABLED or not keys:
        return

    async def run():
        try:
            await asyncio.to_thread(_client().delete_objects, Bucket=BUCKET,
                                    Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True})
        except Exception:  # noqa: BLE001
            log.exception("could not delete %s from Tigris", keys)

    spawn(run())


def spawn(coro) -> None:
    """Fire-and-forget, keeping a reference so the task isn't garbage-collected mid-flight."""
    try:
        task = asyncio.get_running_loop().create_task(coro)
    except RuntimeError:  # no loop (e.g. a sync script): run it inline
        asyncio.run(coro)
        return
    _background.add(task)
    task.add_done_callback(_background.discard)


# --- Mirroring rows' files ----------------------------------------------------------------


def mirror_asset(asset_id: str) -> None:
    """Upload an asset's file and thumbnail in the background, then mark it in_cloud."""
    if ENABLED:
        spawn(_mirror(asset_id, "asset"))


def mirror_run(run_id: str) -> None:
    """Upload a finished render in the background, then mark it in_cloud."""
    if ENABLED:
        spawn(_mirror(run_id, "run"))


async def _mirror(row_id: str, kind: str) -> bool:
    from .db import Asset, Run, Session, engine

    model = Asset if kind == "asset" else Run
    with Session(engine) as s:
        row = s.get(model, row_id)
        if not row:
            return False
        paths = [row.path, row.thumb_path] if kind == "asset" else [row.output_path]
    if not await put_all(paths):
        return False
    with Session(engine) as s:
        row = s.get(model, row_id)
        if not row:  # deleted while uploading: don't leave an orphan in the bucket
            delete_later(paths)
            return False
        row.in_cloud = True
        s.add(row)
        s.commit()
    return True
