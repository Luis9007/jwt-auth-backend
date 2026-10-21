from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import engine, get_db, SessionLocal
from app.routers import audit, auth, roles, users

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-calienta el pool de conexiones con Supabase para evitar demoras en la primera petición
    try:
        async with SessionLocal() as db:
            await db.execute(text("select 1"))
    except Exception as e:
        print(f"Advertencia al conectar con la base de datos: {e}")
    yield
    await engine.dispose()


app = FastAPI(
    title="JWT Auth Backend",
    version="1.0.0",
    description="Autenticación y autorización con JWT (access + refresh con rotación), "
    "roles y permisos, sobre Supabase Postgres.",
    lifespan=lifespan,
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(audit.router)


@app.get("/health", tags=["health"])
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("select 1"))
    return {"status": "ok"}
