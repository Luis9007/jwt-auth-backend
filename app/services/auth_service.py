import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from fastapi import HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    EmailVerification,
    PasswordReset,
    RefreshToken,
    TokenBlacklist,
    User,
)
from app.schemas import TokenPair
from app.security import (
    InvalidToken,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_opaque_token,
    hash_password,
    sha256_hex,
    verify_password,
)
from app.services.audit import audit, client_agent, client_ip


def now() -> datetime:
    return datetime.now(timezone.utc)


def unauthorized(detail: str = "Credenciales inválidas") -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


@lru_cache
def _dummy_hash() -> str:
    # Se usa para igualar tiempos cuando el usuario no existe (evita enumeración).
    return hash_password("dummy-password-1")


async def hash_password_async(password: str) -> str:
    return await run_in_threadpool(hash_password, password)


async def get_user_by_identifier(db: AsyncSession, identifier: str) -> User | None:
    ident = identifier.strip().lower()
    result = await db.execute(
        select(User).where(or_(User.email == ident, User.username == ident))
    )
    return result.scalar_one_or_none()


# ---------- Login ----------
async def authenticate(
    db: AsyncSession, identifier: str, password: str, request: Request
) -> User:
    s = get_settings()
    user = await get_user_by_identifier(db, identifier)

    if user is None:
        await run_in_threadpool(verify_password, password, _dummy_hash())
        audit(db, "login_failed", success=False, request=request, reason="unknown_user")
        await db.commit()
        raise unauthorized()

    if user.locked_until is not None:
        if user.locked_until > now():
            audit(db, "login_blocked", user_id=user.id, success=False, request=request, reason="locked")
            await db.commit()
            raise HTTPException(
                status.HTTP_423_LOCKED,
                "Cuenta bloqueada temporalmente por demasiados intentos fallidos",
            )
        user.locked_until = None
        user.failed_login_attempts = 0

    valid = await run_in_threadpool(verify_password, password, user.password_hash)
    if not valid:
        user.failed_login_attempts += 1
        audit(
            db, "login_failed", user_id=user.id, success=False, request=request,
            reason="invalid_password", attempt=user.failed_login_attempts,
        )
        if user.failed_login_attempts >= s.max_failed_attempts:
            user.locked_until = now() + timedelta(minutes=s.lockout_minutes)
            audit(
                db, "account_locked", user_id=user.id, success=False, request=request,
                locked_minutes=s.lockout_minutes,
            )
        await db.commit()
        raise unauthorized()

    if not user.is_active:
        audit(db, "login_failed", user_id=user.id, success=False, request=request, reason="inactive")
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta desactivada")

    if s.require_email_verification and not user.is_verified:
        audit(db, "login_failed", user_id=user.id, success=False, request=request, reason="unverified")
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email no verificado")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now()
    return user


# ---------- Emisión y rotación de tokens ----------
async def issue_tokens(
    db: AsyncSession, user: User, request: Request, family_id: uuid.UUID | None = None
) -> tuple[TokenPair, RefreshToken]:
    s = get_settings()
    access, _, _ = create_access_token(user.id, user.role_names)
    refresh, jti, exp = create_refresh_token(user.id)
    row = RefreshToken(
        user_id=user.id,
        jti=jti,
        token_hash=sha256_hex(refresh),
        family_id=family_id or uuid.uuid4(),
        expires_at=exp,
        user_agent=client_agent(request),
        ip_address=client_ip(request),
    )
    db.add(row)
    await db.flush()
    pair = TokenPair(
        access_token=access, refresh_token=refresh, expires_in=s.access_token_minutes * 60
    )
    return pair, row


async def revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )


async def revoke_all_user_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )


async def rotate_refresh_token(db: AsyncSession, token: str, request: Request) -> TokenPair:
    try:
        payload = decode_token(token, "refresh")
        user_id = uuid.UUID(payload["sub"])
    except (InvalidToken, ValueError):
        raise unauthorized("Refresh token inválido")

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(token)).with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None or row.user_id != user_id:
        raise unauthorized("Refresh token inválido")

    if row.revoked_at is not None:
        # Reutilización de un token ya rotado/revocado: se invalida toda la familia.
        await revoke_family(db, row.family_id)
        audit(db, "refresh_reuse_detected", user_id=row.user_id, success=False,
              request=request, family_id=row.family_id)
        await db.commit()
        raise unauthorized("Refresh token revocado")

    if row.expires_at <= now():
        raise unauthorized("Refresh token expirado")

    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise unauthorized("Usuario no disponible")

    pair, new_row = await issue_tokens(db, user, request, family_id=row.family_id)
    row.revoked_at = now()
    row.replaced_by = new_row.id
    audit(db, "token_refresh", user_id=user.id, request=request)
    await db.commit()
    return pair


async def blacklist_access_token(
    db: AsyncSession, jti: uuid.UUID, user_id: uuid.UUID, exp: datetime, reason: str
) -> None:
    if await db.get(TokenBlacklist, jti) is None:
        db.add(TokenBlacklist(jti=jti, user_id=user_id, reason=reason, expires_at=exp))


# ---------- Tokens de un solo uso (verificación de email / reset) ----------
async def create_one_time_token(
    db: AsyncSession, model: type[EmailVerification] | type[PasswordReset], user_id: uuid.UUID, ttl: timedelta
) -> str:
    # Invalida los anteriores sin usar
    await db.execute(
        update(model).where(model.user_id == user_id, model.used_at.is_(None)).values(used_at=now())
    )
    raw = generate_opaque_token()
    db.add(model(user_id=user_id, token_hash=sha256_hex(raw), expires_at=now() + ttl))
    await db.flush()
    return raw


async def consume_one_time_token(
    db: AsyncSession, model: type[EmailVerification] | type[PasswordReset], raw: str
) -> uuid.UUID | None:
    result = await db.execute(
        select(model)
        .where(model.token_hash == sha256_hex(raw), model.used_at.is_(None), model.expires_at > now())
        .with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    row.used_at = now()
    return row.user_id
