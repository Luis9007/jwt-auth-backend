import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import User


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if len(value.encode()) > 72:
        raise ValueError("La contraseña no puede superar 72 bytes (límite de bcrypt)")
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("La contraseña debe incluir al menos una letra y un número")
    return value


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(pattern=r"^[A-Za-z0-9_.-]{3,32}$")
    password: str
    full_name: str | None = Field(default=None, max_length=120)

    _check_password = field_validator("password")(validate_password_strength)


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255, description="Email o username")
    password: str = Field(min_length=1, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Segundos de vida del access token")


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class TokenRequest(BaseModel):
    token: str


class EmailRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    _check_password = field_validator("new_password")(validate_password_strength)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    _check_password = field_validator("new_password")(validate_password_strength)


class MessageResponse(BaseModel):
    detail: str
    # Solo se rellena si DEV_EXPOSE_TOKENS=true (no hay servicio de email integrado)
    dev_token: str | None = None


# ---------- Usuarios ----------
class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str | None
    is_active: bool
    is_verified: bool
    roles: list[str]
    permissions: list[str]
    created_at: datetime
    last_login_at: datetime | None

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            is_verified=user.is_verified,
            roles=user.role_names,
            permissions=user.permission_codes,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )


class RegisterResponse(BaseModel):
    user: UserOut
    dev_verification_token: str | None = None


class UserPage(BaseModel):
    items: list[UserOut]
    total: int
    limit: int
    offset: int


class UpdateMeRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None
    is_verified: bool | None = None


# ---------- Roles y permisos ----------
class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    description: str | None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    permissions: list[PermissionOut]


class CreateRoleRequest(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{1,31}$")
    description: str | None = Field(default=None, max_length=255)


class SetRolePermissionsRequest(BaseModel):
    permission_codes: list[str]


# ---------- Auditoría ----------
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    user_id: uuid.UUID | None
    event: str
    success: bool
    ip_address: str | None
    user_agent: str | None
    metadata: dict = Field(validation_alias="meta")
    created_at: datetime

    @field_validator("ip_address", mode="before")
    @classmethod
    def _ip_to_str(cls, v):
        return None if v is None else str(v)


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int
