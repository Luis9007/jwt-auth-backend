from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

_settings = get_settings()

_connect_args: dict = {}
# El Transaction pooler de Supabase (puerto 6543) no soporta prepared statements.
if ":6543" in _settings.database_url:
    _connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    _settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    pool_pre_ping=False,
    connect_args=_connect_args,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
