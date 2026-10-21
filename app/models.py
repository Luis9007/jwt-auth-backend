"""Modelos alineados con las tablas jwt_* creadas en Supabase."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """timestamptz que siempre devuelve datetimes con zona UTC (también en SQLite)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


IPType = String(45).with_variant(INET(), "postgresql")
JSONType = JSON().with_variant(JSONB(), "postgresql")
BigIntPK = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


user_roles = Table(
    "jwt_user_roles",
    Base.metadata,
    Column("user_id", Uuid, ForeignKey("jwt_users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("jwt_roles.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", UTCDateTime, nullable=False, default=utcnow, server_default=func.now()),
)

role_permissions = Table(
    "jwt_role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("jwt_roles.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "permission_id",
        Integer,
        ForeignKey("jwt_permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Permission(Base):
    __tablename__ = "jwt_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )


class Role(Base):
    __tablename__ = "jwt_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )

    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )


class User(Base):
    __tablename__ = "jwt_users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True)
    username: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(UTCDateTime)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, onupdate=utcnow, server_default=func.now()
    )

    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")

    @property
    def role_names(self) -> list[str]:
        return sorted(r.name for r in self.roles)

    @property
    def permission_codes(self) -> list[str]:
        return sorted({p.code for r in self.roles for p in r.permissions})


class RefreshToken(Base):
    __tablename__ = "jwt_refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jwt_users.id", ondelete="CASCADE"), index=True
    )
    jti: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    replaced_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("jwt_refresh_tokens.id", ondelete="SET NULL")
    )
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(IPType)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )


class TokenBlacklist(Base):
    __tablename__ = "jwt_token_blacklist"

    jti: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("jwt_users.id", ondelete="CASCADE")
    )
    reason: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )


class _OneTimeToken:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now()
    )


class PasswordReset(_OneTimeToken, Base):
    __tablename__ = "jwt_password_resets"
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jwt_users.id", ondelete="CASCADE"), index=True
    )


class EmailVerification(_OneTimeToken, Base):
    __tablename__ = "jwt_email_verifications"
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jwt_users.id", ondelete="CASCADE"), index=True
    )


class AuditLog(Base):
    __tablename__ = "jwt_audit_logs"

    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("jwt_users.id", ondelete="SET NULL"), index=True
    )
    event: Mapped[str] = mapped_column(Text, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    ip_address: Mapped[str | None] = mapped_column(IPType)
    user_agent: Mapped[str | None] = mapped_column(Text)
    # "metadata" está reservado por SQLAlchemy; la columna se llama igual en la BD.
    meta: Mapped[dict] = mapped_column("metadata", JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=utcnow, server_default=func.now(), index=True
    )
