from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import Principal, require_permissions
from app.models import Permission, Role
from app.schemas import CreateRoleRequest, PermissionOut, RoleOut, SetRolePermissionsRequest
from app.services.audit import audit

router = APIRouter(tags=["roles"])


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    _: Principal = Depends(require_permissions("roles:read")), db: AsyncSession = Depends(get_db)
):
    return (await db.execute(select(Role).options(selectinload(Role.permissions)).order_by(Role.id))).scalars().all()


@router.get("/permissions", response_model=list[PermissionOut])
async def list_permissions(
    _: Principal = Depends(require_permissions("roles:read")), db: AsyncSession = Depends(get_db)
):
    return (await db.execute(select(Permission).order_by(Permission.code))).scalars().all()


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: CreateRoleRequest,
    request: Request,
    principal: Principal = Depends(require_permissions("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    role = Role(name=body.name, description=body.description, permissions=[])
    db.add(role)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "El rol ya existe")
    audit(db, "role_created", user_id=principal.user.id, request=request, role=body.name)
    await db.commit()
    return role


@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
async def set_role_permissions(
    role_id: int,
    body: SetRolePermissionsRequest,
    request: Request,
    principal: Principal = Depends(require_permissions("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    role = await db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol no encontrado")
    codes = set(body.permission_codes)
    perms = (await db.execute(select(Permission).where(Permission.code.in_(codes)))).scalars().all()
    unknown = codes - {p.code for p in perms}
    if unknown:
        raise HTTPException(
            422, f"Permisos desconocidos: {', '.join(sorted(unknown))}"
        )
    if role.name == "admin":
        # Evita dejar el sistema sin capacidad de administración por error
        required = {"roles:write", "users:read", "users:write"}
        if not required <= codes:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"El rol admin debe conservar: {', '.join(sorted(required))}",
            )
    role.permissions = list(perms)
    audit(db, "role_permissions_set", user_id=principal.user.id, request=request,
          role=role.name, permissions=",".join(sorted(codes)))
    await db.commit()
    return role
