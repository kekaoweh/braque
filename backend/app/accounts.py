"""Who pays for a run, how much they've used, and email/password sign-in.

A run that uses Claude (mode "agent") is paid for by, in order:
1. the user's own credential (an API key they added, or the admin's Claude account), else
2. the studio key (PICASSO_STUDIO_API_KEY), up to PICASSO_STUDIO_MONTHLY_LIMIT_USD per user per month.
"""

import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from sqlmodel import Session, func, select

from .config import OWNER_WORKSPACE, STUDIO_API_KEY, STUDIO_MONTHLY_LIMIT_USD, fernet
from .db import Run, User


class CredentialError(Exception):
    """No credential can pay for this run; the message is shown to the user."""


def studio_key_ready() -> bool:
    return STUDIO_API_KEY.startswith("sk-ant-api")


def is_admin(user: User) -> bool:
    # On a configured server the admin is the owner's workspace; locally (no owner configured),
    # whoever signed in with a Claude account.
    return user.id == OWNER_WORKSPACE if OWNER_WORKSPACE else user.token_kind == "oauth"


def month_start() -> datetime:
    today = datetime.now(timezone.utc)
    return datetime(today.year, today.month, 1, tzinfo=timezone.utc)


def studio_spend(db: Session, user_id: str) -> float:
    """Studio-key dollars this user has used since the start of the month (UTC)."""
    total = db.exec(select(func.sum(Run.cost_usd)).where(
        Run.user_id == user_id, Run.billed_to == "studio", Run.created_at >= month_start())).one()
    return float(total or 0)


def payer_for(db: Session, user: User) -> str:
    """'own' or 'studio' for a new agent run, or raise CredentialError explaining what's missing."""
    if user.token_enc:
        return "own"
    if not studio_key_ready():
        raise CredentialError("Add your Anthropic API key in Settings → Account to make videos. "
                              "(This studio doesn't provide shared credit yet.)")
    if studio_spend(db, user.id) >= STUDIO_MONTHLY_LIMIT_USD:
        raise CredentialError(f"You've used this month's ${STUDIO_MONTHLY_LIMIT_USD:g} of studio credit. "
                              "It resets on the 1st, or add your own Anthropic API key in Settings → Account "
                              "to keep going now.")
    return "studio"


def credential(user: User, payer: str) -> tuple[str, str]:
    """(token, kind) for a run billed to `payer`."""
    if payer == "studio":
        return STUDIO_API_KEY, "api_key"
    return fernet.decrypt(user.token_enc.encode()).decode(), user.token_kind


# --- Passwords --------------------------------------------------------------------------------
# scrypt from the standard library: memory-hard and salted, no extra dependency.

_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=_N, r=_R, p=_P, dklen=32)
    return hmac.compare_digest(candidate.hex(), digest)


class Throttle:
    """At most `limit` failed attempts per key per `window` seconds (in memory; one server)."""

    def __init__(self, limit: int = 8, window: float = 15 * 60):
        self.limit, self.window = limit, window
        self.failures: dict[str, deque[float]] = defaultdict(deque)

    def blocked(self, key: str) -> bool:
        q = self.failures[key]
        while q and q[0] < time.monotonic() - self.window:
            q.popleft()
        return len(q) >= self.limit

    def fail(self, key: str) -> None:
        self.failures[key].append(time.monotonic())

    def clear(self, key: str) -> None:
        self.failures.pop(key, None)
