"""Throwaway signed-in accounts for local end-to-end testing.

    uv run python scripts/dev_session.py create   # prints a session cookie value for a test user
    uv run python scripts/dev_session.py cleanup  # removes test users and everything they made

The test user's Claude token is fake, so agent runs fail with the friendly auth error; everything
else in the app works normally. Never run this against a production database.
"""

import hashlib
import secrets
import shutil
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import CLAUDE_HOMES_DIR, UPLOADS_DIR, fernet  # noqa: E402
from app.db import (  # noqa: E402
    Asset, AuthSession, Project, Run, RunEvent, Session, Style, User, engine, init_db, now, select,
)

PREFIX = "usr_e2etest_"


def create() -> None:
    init_db()
    user_id = PREFIX + secrets.token_hex(4)
    cookie = secrets.token_urlsafe(24)
    with Session(engine) as s:
        s.add(User(id=user_id, name="UI Test", token_kind="oauth",
                   token_enc=fernet.encrypt(b"sk-ant-oat01-not-a-real-token").decode(), token_hint="sk-ant-oat…test"))
        s.add(AuthSession(id=hashlib.sha256(cookie.encode()).hexdigest(), user_id=user_id,
                          expires_at=now() + timedelta(hours=2)))
        s.commit()
    print(cookie)


def cleanup() -> None:
    with Session(engine) as s:
        users = s.exec(select(User).where(User.id.startswith(PREFIX))).all()
        for u in users:
            for r in s.exec(select(Run).where(Run.user_id == u.id)).all():
                for e in s.exec(select(RunEvent).where(RunEvent.run_id == r.id)).all():
                    s.delete(e)
                if r.output_path:
                    Path(r.output_path).unlink(missing_ok=True)
                s.delete(r)
            for a in s.exec(select(Asset).where(Asset.user_id == u.id)).all():
                Path(a.path).unlink(missing_ok=True)
                if a.thumb_path:
                    Path(a.thumb_path).unlink(missing_ok=True)
                s.delete(a)
            for model in (Project, Style, AuthSession):
                for row in s.exec(select(model).where(model.user_id == u.id)).all():
                    s.delete(row)
            s.delete(u)
            shutil.rmtree(UPLOADS_DIR / u.id, ignore_errors=True)
            shutil.rmtree(CLAUDE_HOMES_DIR / u.id, ignore_errors=True)
        s.commit()
    print(f"removed {len(users)} test user(s)")


if __name__ == "__main__":
    {"create": create, "cleanup": cleanup}[sys.argv[1] if len(sys.argv) > 1 else "create"]()
