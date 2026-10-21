import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings


class InvalidToken(Exception):
    pass


# ---------- Contraseñas ----------
def hash_password(password: str) -> str:
    rounds = get_settings().bcrypt_rounds
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


# ---------- Tokens opacos (reset / verificación) ----------
def generate_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# ---------- JWT ----------
def _encode(claims: dict) -> str:
    s = get_settings()
    return jwt.encode(claims, s.jwt_secret, algorithm=s.jwt_algorithm)


def _claims(user_id: uuid.UUID, token_type: str, ttl: timedelta, **extra) -> tuple[dict, uuid.UUID, datetime]:
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4()
    exp = now + ttl
    claims = {
        "iss": get_settings().jwt_issuer,
        "sub": str(user_id),
        "jti": str(jti),
        "type": token_type,
        "iat": now,
        "exp": exp,
        **extra,
    }
    return claims, jti, exp


def create_access_token(user_id: uuid.UUID, roles: list[str]) -> tuple[str, uuid.UUID, datetime]:
    ttl = timedelta(minutes=get_settings().access_token_minutes)
    claims, jti, exp = _claims(user_id, "access", ttl, roles=roles)
    return _encode(claims), jti, exp


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, uuid.UUID, datetime]:
    ttl = timedelta(days=get_settings().refresh_token_days)
    claims, jti, exp = _claims(user_id, "refresh", ttl)
    return _encode(claims), jti, exp


def decode_token(token: str, expected_type: str) -> dict:
    s = get_settings()
    try:
        payload = jwt.decode(
            token,
            s.jwt_secret,
            algorithms=[s.jwt_algorithm],
            issuer=s.jwt_issuer,
            options={"require": ["exp", "iat", "sub", "jti", "type"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc
    if payload.get("type") != expected_type:
        raise InvalidToken("wrong token type")
    return payload
