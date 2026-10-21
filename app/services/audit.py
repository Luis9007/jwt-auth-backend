import ipaddress

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def client_ip(request: Request | None) -> str | None:
    if request is None or request.client is None:
        return None
    try:
        return str(ipaddress.ip_address(request.client.host))
    except ValueError:
        return None


def client_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:512] if ua else None


def audit(
    db: AsyncSession,
    event: str,
    *,
    user_id=None,
    success: bool = True,
    request: Request | None = None,
    **meta,
) -> None:
    """Añade un registro de auditoría a la sesión (el commit lo hace quien llama)."""
    db.add(
        AuditLog(
            user_id=user_id,
            event=event,
            success=success,
            ip_address=client_ip(request),
            user_agent=client_agent(request),
            meta={k: (str(v) if not isinstance(v, (int, float, bool, type(None))) else v) for k, v in meta.items()},
        )
    )
