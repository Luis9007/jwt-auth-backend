import os

os.environ.update(
    DATABASE_URL="sqlite+aiosqlite://",
    JWT_SECRET="test-secret-test-secret-test-secret-123",
    DEV_EXPOSE_TOKENS="true",
    MAX_FAILED_ATTEMPTS="3",
    BCRYPT_ROUNDS="4",
)

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base, Permission, Role, User
from app.security import hash_password

PERMISSIONS = [
    "users:read", "users:write", "users:delete", "roles:read",
    "roles:write", "audit:read", "profile:read", "profile:write",
]
ROLE_PERMS = {
    "admin": PERMISSIONS,
    "manager": ["users:read", "users:write", "roles:read", "audit:read", "profile:read", "profile:write"],
    "user": ["profile:read", "profile:write"],
}


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        perms = {c: Permission(code=c) for c in PERMISSIONS}
        db.add_all(perms.values())
        for name, codes in ROLE_PERMS.items():
            db.add(Role(name=name, permissions=[perms[c] for c in codes]))
        await db.commit()
    yield factory
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory):
    async def override():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def create_user(factory, username, password, role="user", verified=True, active=True):
    from sqlalchemy import select

    async with factory() as db:
        r = (await db.execute(select(Role).where(Role.name == role))).scalar_one()
        db.add(
            User(
                email=f"{username}@example.com",
                username=username,
                password_hash=hash_password(password),
                is_verified=verified,
                is_active=active,
                roles=[r],
            )
        )
        await db.commit()


@pytest_asyncio.fixture
async def admin_headers(client, session_factory):
    await create_user(session_factory, "admin", "Admin123!", role="admin")
    r = await client.post("/auth/login", json={"identifier": "admin", "password": "Admin123!"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def login(client, identifier, password):
    r = await client.post("/auth/login", json={"identifier": identifier, "password": password})
    return r
