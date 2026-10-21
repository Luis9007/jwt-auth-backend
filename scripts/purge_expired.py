"""Limpia filas caducadas. Ejecútalo periódicamente (cron, pg_cron o scheduler):

    python -m scripts.purge_expired
"""
import asyncio
from datetime import datetime, timezone

from sqlalchemy import delete

from app.database import SessionLocal, engine
from app.models import EmailVerification, PasswordReset, RefreshToken, TokenBlacklist


async def main() -> None:
    now = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        for model in (TokenBlacklist, RefreshToken, PasswordReset, EmailVerification):
            res = await db.execute(delete(model).where(model.expires_at < now))
            print(f"{model.__tablename__}: {res.rowcount} filas eliminadas")
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
