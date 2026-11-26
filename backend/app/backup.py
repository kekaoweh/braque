"""Daily copies of the database (and the key that decrypts stored credentials) on the server's disk.

They protect against a bad update, a mistaken delete or a corrupted file; `deploy/gcp-vm.sh backup`
downloads them so a copy also lives off the server. Copies use SQLite's online backup API, so they're
consistent even while the app is writing.

    python -m app.backup      # take one now
"""

import asyncio
import logging
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .config import DATA_DIR, DATABASE_URL

log = logging.getLogger("braque.backup")

BACKUP_DIR = DATA_DIR / "backups"
KEEP = 14  # days of copies
EVERY = 24 * 3600


def _db_path() -> Path | None:
    prefix = "sqlite:///"
    return Path(DATABASE_URL.removeprefix(prefix)) if DATABASE_URL.startswith(prefix) else None


def backup_now() -> Path | None:
    db = _db_path()
    if not db or not db.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = BACKUP_DIR / f"braque-{stamp}.db"
    tmp = out.with_suffix(".db.part")
    src, dst = sqlite3.connect(db), sqlite3.connect(tmp)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    tmp.replace(out)
    key = DATA_DIR / "secret.key"
    if key.exists():  # without it, the encrypted keys in a restored database can't be read
        shutil.copy2(key, BACKUP_DIR / "secret.key")
    for old in sorted(BACKUP_DIR.glob("braque-*.db"))[:-KEEP]:
        old.unlink()
    out.chmod(0o600)
    return out


def _latest_age() -> float:
    copies = sorted(BACKUP_DIR.glob("braque-*.db"))
    if not copies:
        return float("inf")
    return datetime.now(timezone.utc).timestamp() - copies[-1].stat().st_mtime


async def run_forever() -> None:
    """Back up at startup if the newest copy is over a day old, then once a day."""
    while True:
        if _latest_age() >= EVERY:
            try:
                path = await asyncio.to_thread(backup_now)
                if path:
                    log.info("database backed up to %s", path.name)
            except Exception:  # noqa: BLE001 - a failed backup must never take the app down
                log.exception("database backup failed")
        await asyncio.sleep(3600)


if __name__ == "__main__":
    print(backup_now() or "no SQLite database to back up")
