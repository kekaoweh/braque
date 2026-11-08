"""Copy existing media to Tigris and mark it in_cloud (safe to re-run; skips what's done).

    uv run python scripts/sync_storage.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import storage  # noqa: E402
from app.db import Asset, Run, Session, engine, init_db, select  # noqa: E402


async def main() -> None:
    if not storage.ENABLED:
        sys.exit("Set TIGRIS_ACCESS_KEY_ID, TIGRIS_SECRET_ACCESS_KEY and TIGRIS_BUCKET first.")
    init_db()
    with Session(engine) as s:
        assets = [a.id for a in s.exec(select(Asset).where(Asset.in_cloud == False)).all()]  # noqa: E712
        runs = [r.id for r in s.exec(select(Run).where(Run.in_cloud == False, Run.output_path.is_not(None))).all()]  # noqa: E712
    done = failed = 0
    for kind, ids in (("asset", assets), ("run", runs)):
        for row_id in ids:
            ok = await storage._mirror(row_id, kind)
            done += ok
            failed += not ok
            print(f"{'ok  ' if ok else 'FAIL'} {kind} {row_id}")
    print(f"{done} uploaded, {failed} failed (failures keep their local copy; re-run to retry)")


if __name__ == "__main__":
    asyncio.run(main())
