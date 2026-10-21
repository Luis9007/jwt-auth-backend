import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import Principal, require_permissions
from app.models import AuditLog
from app.schemas import AuditLogOut, AuditLogPage

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=AuditLogPage)
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event: str | None = None,
    user_id: uuid.UUID | None = None,
    success: bool | None = None,
    _: Principal = Depends(require_permissions("audit:read")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog)
    count = select(func.count()).select_from(AuditLog)
    for col, val in ((AuditLog.event, event), (AuditLog.user_id, user_id), (AuditLog.success, success)):
        if val is not None:
            stmt, count = stmt.where(col == val), count.where(col == val)
    total = (await db.execute(count)).scalar_one()
    rows = (
        await db.execute(stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset))
    ).scalars()
    return AuditLogPage(
        items=[AuditLogOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset
    )
