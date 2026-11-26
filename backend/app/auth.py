import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from . import accounts
from .agent import verify_credential
from .config import (CLAUDE_ACCOUNT_ALLOWLIST, COOKIE_NAME, COOKIE_SECURE, INVITE_CODE, OWNER_CODE,
                     OWNER_WORKSPACE, SESSION_DAYS, fernet)
from .db import AuthSession, User, get_session, now

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


_TOKEN = re.compile(r"[A-Za-z0-9_-]+")
# Whitespace, quotes and the box-drawing borders terminals draw around output.
_FRAME = " \t\"'`|" + "".join(chr(c) for c in range(0x2500, 0x2580))


def clean_token(raw: str) -> str:
    """Pull the key out of whatever was pasted. Copies from a terminal often bring along words
    ("Your OAuth token: …"), `export VAR=` prefixes, box borders, quotes, or the key wrapped over
    several lines; a wrapped continuation is a line holding nothing but key characters."""
    lines = raw.replace("\r", "").split("\n")
    for i, line in enumerate(lines):
        start = line.find("sk-ant-")
        if start < 0:
            continue
        token = _TOKEN.match(line, start).group(0)
        rest = line[start + len(token):]
        for nxt in lines[i + 1:]:
            if rest.strip(_FRAME):
                break  # something other than a border followed the key on its line: it ended there
            part = nxt.strip(_FRAME)
            if not part or not _TOKEN.fullmatch(part):
                break
            token, rest = token + part, ""
        return token
    return "".join(raw.split()).strip(_FRAME)


def token_kind(token: str) -> str:
    if token.startswith("sk-ant-oat"):
        return "oauth"
    if token.startswith("sk-ant-api"):
        return "api_key"
    if token.startswith("sk-ant-admin"):
        raise HTTPException(400, "That's an Admin API key, which can't run Claude. In console.anthropic.com "
                                 "go to API keys (not Admin keys) and create a regular key; it starts with sk-ant-api.")
    seen = f" What was pasted starts with “{token[:6]}…”." if token else ""
    raise HTTPException(400, "That doesn't look like an Anthropic key." + seen + " Paste an API key from "
                             "console.anthropic.com (it starts with sk-ant-api) or the token `claude setup-token` "
                             "prints in Terminal (it starts with sk-ant-oat). If the browser showed you a code "
                             "during setup-token, that code goes back into Terminal; the token appears there after.")


def claude_accounts_restricted() -> bool:
    return bool(CLAUDE_ACCOUNT_ALLOWLIST or OWNER_CODE)


class LoginIn(BaseModel):
    token: str = Field(min_length=20, max_length=500)
    name: str = Field(default="", max_length=80)
    invite: str = Field(default="", max_length=200)
    owner_code: str = Field(default="", max_length=200)


class AccessOut(BaseModel):
    invite_required: bool
    studio_credit: bool  # customers without a key run on the studio key
    studio_monthly_limit: float
    claude_account_restricted: bool
    owner_code_enabled: bool


@router.get("/access", response_model=AccessOut)
def access():
    """What the sign-in page should ask for."""
    return AccessOut(invite_required=bool(INVITE_CODE), studio_credit=accounts.studio_key_ready(),
                     studio_monthly_limit=accounts.STUDIO_MONTHLY_LIMIT_USD, claude_account_restricted=claude_accounts_restricted(),
                     owner_code_enabled=bool(OWNER_CODE))


class UserOut(BaseModel):
    id: str
    name: str
    email: Optional[str]
    # How they sign in: "email" (password), "key" (an API key) or "claude" (Claude-account token).
    method: str
    token_kind: str  # their own credential: "oauth", "api_key" or "" (none: the studio key pays)
    token_hint: str
    is_admin: bool


def user_out(user: User) -> UserOut:
    method = "email" if user.email else ("claude" if user.token_kind == "oauth" else "key")
    return UserOut(id=user.id, name=user.name, email=user.email, method=method, token_kind=user.token_kind,
                   token_hint=user.token_hint, is_admin=accounts.is_admin(user))


def _start_session(db: Session, response: Response, user: User) -> None:
    raw = secrets.token_urlsafe(32)
    db.add(AuthSession(id=_sha(raw), user_id=user.id, expires_at=now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    db.refresh(user)
    response.set_cookie(COOKIE_NAME, raw, max_age=SESSION_DAYS * 86400, httponly=True,
                        samesite="lax", secure=COOKIE_SECURE, path="/")


# --- Email accounts ---------------------------------------------------------------------------

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_signin_throttle = accounts.Throttle()


class SignupIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    name: str = Field(default="", max_length=80)
    invite: str = Field(default="", max_length=200)


class SigninIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


@router.post("/signup", response_model=UserOut)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_session)):
    email = body.email.strip().lower()
    if not EMAIL.match(email):
        raise HTTPException(400, "Enter a valid email address.")
    if len(body.password) < 8:
        raise HTTPException(400, "Use a password of at least 8 characters.")
    if INVITE_CODE and not hmac.compare_digest("".join(body.invite.split()).strip(_FRAME), INVITE_CODE):
        raise HTTPException(403, "This studio is invite-only. Enter the invite code you were given.")
    if db.exec(select(User).where(User.email == email)).first():
        raise HTTPException(409, "There's already an account with that email. Sign in instead.")
    user = User(id="usr_" + secrets.token_hex(10), name=body.name.strip() or email.split("@")[0],
                email=email, password_hash=accounts.hash_password(body.password))
    db.add(user)
    _start_session(db, response, user)
    return user_out(user)


@router.post("/signin", response_model=UserOut)
def signin(body: SigninIn, response: Response, db: Session = Depends(get_session)):
    email = body.email.strip().lower()
    if _signin_throttle.blocked(email):
        raise HTTPException(429, "Too many attempts. Wait 15 minutes and try again.")
    user = db.exec(select(User).where(User.email == email)).first()
    if not user or not accounts.check_password(body.password, user.password_hash):
        _signin_throttle.fail(email)
        raise HTTPException(401, "That email and password don't match.")
    _signin_throttle.clear(email)
    _start_session(db, response, user)
    return user_out(user)


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response, db: Session = Depends(get_session)):
    token = clean_token(body.token)
    kind = token_kind(token)
    # One workspace per Claude credential: signing in again with the same token lands
    # in the same workspace.
    user_id = "usr_" + _sha("picasso-user:" + token)[:20]
    owner = False
    # Gatekeeping happens before the token is checked with Claude, so refusals are instant.
    if kind == "oauth" and claude_accounts_restricted() and user_id not in CLAUDE_ACCOUNT_ALLOWLIST:
        code = "".join(body.owner_code.split()).strip(_FRAME)
        if not OWNER_CODE or not code:
            raise HTTPException(403, "Claude-account sign-in is for the site admin"
                                     + (". Enter the admin code in step 3." if OWNER_CODE else ".")
                                     + " Everyone else: sign in with an Anthropic API key (sk-ant-api…) "
                                       "from console.anthropic.com.")
        if not hmac.compare_digest(code, OWNER_CODE):
            raise HTTPException(403, f"That admin code doesn't match (you entered {len(code)} characters, "
                                     f"starting “{code[:3]}…”). Check it against deploy/.env "
                                     "(PICASSO_OWNER_CODE) and try again.")
        # The owner's tokens change (each `claude setup-token` makes a new one); their workspace doesn't.
        owner = True
        user_id = OWNER_WORKSPACE or user_id
    if INVITE_CODE and not owner and not db.get(User, user_id) \
            and not hmac.compare_digest(body.invite.strip(), INVITE_CODE):
        raise HTTPException(403, "This studio is invite-only. Enter the invite code you were given.")
    try:
        await verify_credential(token, kind, user_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(401, f"Claude didn't accept that token: {exc}") from exc

    user = db.get(User, user_id)
    if not user:
        user = User(id=user_id, name=body.name.strip() or "My workspace", token_kind=kind,
                    token_enc="", token_hint="")
    elif body.name.strip():
        user.name = body.name.strip()
    user.token_kind = kind
    user.token_enc = fernet.encrypt(token.encode()).decode()
    user.token_hint = f"{token[:10]}…{token[-4:]}"
    db.add(user)

    _start_session(db, response, user)
    return user_out(user)


def current_user(
    picasso_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_session),
) -> User:
    if not picasso_session:
        raise HTTPException(401, "Not signed in")
    session = db.get(AuthSession, _sha(picasso_session))
    if not session or session.expires_at.replace(tzinfo=now().tzinfo) < now():
        raise HTTPException(401, "Session expired")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Not signed in")
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user_out(user)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    user.name = body.name.strip()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.post("/logout")
def logout(response: Response,
           picasso_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
           db: Session = Depends(get_session)):
    if picasso_session:
        session = db.get(AuthSession, _sha(picasso_session))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.post("/forget")
def forget(response: Response, user: User = Depends(current_user), db: Session = Depends(get_session)):
    """Sign out everywhere and drop the stored Claude token."""
    for session in db.exec(select(AuthSession).where(AuthSession.user_id == user.id)).all():
        db.delete(session)
    user.token_enc = ""
    user.token_hint = ""
    db.add(user)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


# --- Account: usage, own key, password --------------------------------------------------------


class AccountOut(BaseModel):
    payer: str  # who pays for the next video: "own", "studio" or "none"
    studio_credit: bool
    studio_spent: float  # this month, USD
    studio_limit: float
    has_password: bool


@router.get("/account", response_model=AccountOut)
def account(user: User = Depends(current_user), db: Session = Depends(get_session)):
    try:
        payer = accounts.payer_for(db, user)
    except accounts.CredentialError:
        payer = "none"
    return AccountOut(payer=payer, studio_credit=accounts.studio_key_ready(),
                      studio_spent=round(accounts.studio_spend(db, user.id), 4),
                      studio_limit=accounts.STUDIO_MONTHLY_LIMIT_USD, has_password=bool(user.password_hash))


class KeyIn(BaseModel):
    token: str = Field(min_length=20, max_length=2000)


@router.put("/account/key", response_model=UserOut)
async def set_key(body: KeyIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    """Use your own Anthropic API key (no monthly limit from the studio)."""
    token = clean_token(body.token)
    kind = token_kind(token)
    if kind == "oauth" and not accounts.is_admin(user):
        raise HTTPException(403, "Only the site admin can use a Claude-account token here. Add an Anthropic "
                                 "API key (sk-ant-api…) from console.anthropic.com instead.")
    try:
        await verify_credential(token, kind, user.id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(401, f"Claude didn't accept that key: {exc}") from exc
    user.token_kind = kind
    user.token_enc = fernet.encrypt(token.encode()).decode()
    user.token_hint = f"{token[:10]}…{token[-4:]}"
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.delete("/account/key", response_model=UserOut)
def remove_key(user: User = Depends(current_user), db: Session = Depends(get_session)):
    if not user.email:
        raise HTTPException(400, "This account signs in with its key, so it can't be removed. "
                                 "Use “Disconnect” to sign out everywhere instead.")
    user.token_kind = user.token_enc = user.token_hint = ""
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)


class PasswordIn(BaseModel):
    current: str = Field(default="", max_length=200)
    new: str = Field(max_length=200)


@router.put("/account/password")
def change_password(body: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if not user.email:
        raise HTTPException(400, "This account signs in with a key, not a password.")
    if not accounts.check_password(body.current, user.password_hash):
        raise HTTPException(403, "Your current password isn't right.")
    if len(body.new) < 8:
        raise HTTPException(400, "Use a new password of at least 8 characters.")
    user.password_hash = accounts.hash_password(body.new)
    db.add(user)
    db.commit()
    return {"ok": True}


# --- Site admin ---------------------------------------------------------------------------------


class AdminUserOut(BaseModel):
    id: str
    name: str
    email: Optional[str]
    method: str
    pays: str  # "own key", "studio credit" or "none yet"
    studio_spent: float
    videos: int
    created_at: str


@router.get("/admin/users", response_model=list[AdminUserOut])
def admin_users(user: User = Depends(current_user), db: Session = Depends(get_session)):
    if not accounts.is_admin(user):
        raise HTTPException(403, "Only the site admin can see this.")
    from .db import Project  # local import: auth must not depend on the studio models at import time

    out = []
    for u in db.exec(select(User).order_by(User.created_at)).all():
        try:
            pays = {"own": "own key", "studio": "studio credit"}[accounts.payer_for(db, u)]
        except accounts.CredentialError:
            pays = "studio credit (limit reached)" if u.email and accounts.studio_key_ready() else "none yet"
        videos = len(db.exec(select(Project.id).where(Project.user_id == u.id)).all())
        info = user_out(u)
        out.append(AdminUserOut(id=u.id, name=u.name, email=u.email, method=info.method, pays=pays,
                                studio_spent=round(accounts.studio_spend(db, u.id), 2), videos=videos,
                                created_at=u.created_at.isoformat()))
    return out
