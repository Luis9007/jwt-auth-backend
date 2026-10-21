import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Role, TokenBlacklist, User
from app.security import InvalidToken, decode_token
from app.services.auth_service import unauthorized

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


@dataclass
class Principal:
    user: User
    jti: uuid.UUID
    exp: datetime

    @property
    def roles(self) -> set[str]:
        return set(self.user.role_names)

    @property
    def permissions(self) -> set[str]:
        return set(self.user.permission_codes)


async def get_principal(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> Principal:
    try:
        payload = decode_token(token, "access")
        user_id = uuid.UUID(payload["sub"])
        jti = uuid.UUID(payload["jti"])
    except (InvalidToken, ValueError):
        raise unauthorized("Token inválido o expirado")

    if await db.get(TokenBlacklist, jti) is not None:
        raise unauthorized("Token revocado")

    # Roles y permisos se leen con eager loading para evitar múltiples roundtrips a la BD.
    user = (
        await db.execute(
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise unauthorized("Usuario no disponible")

    return Principal(
        user=user, jti=jti, exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    )


def require_roles(*roles: str):
    """Exige AL MENOS UNO de los roles indicados."""

    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if not principal.roles.intersection(roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Rol insuficiente")
        return principal

    return dependency


def require_permissions(*codes: str):
    """Exige TODOS los permisos indicados."""

    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        missing = set(codes) - principal.permissions
        if missing:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Permisos insuficientes: {', '.join(sorted(missing))}"
            )
        return principal

    return dependency
