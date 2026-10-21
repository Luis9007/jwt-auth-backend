import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import Principal, get_principal, require_permissions
from app.models import Role, User
from app.schemas import AdminUpdateUserRequest, UpdateMeRequest, UserOut, UserPage
from app.services import auth_service as svc
from app.services.audit import audit

router = APIRouter(prefix="/users", tags=["users"])


async def _get_user_or_404(db: AsyncSession, user_id: uuid.UUID) -> User:
    stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user_id)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return user


@router.get("/me", response_model=UserOut)
async def me(principal: Principal = Depends(get_principal)):
    return UserOut.from_user(principal.user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UpdateMeRequest,
    principal: Principal = Depends(require_permissions("profile:write")),
    db: AsyncSession = Depends(get_db),
):
    principal.user.full_name = body.full_name
    await db.commit()
    return UserOut.from_user(principal.user)


@router.get("", response_model=UserPage)
async def list_users(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Filtra por email, username o nombre"),
    _: Principal = Depends(require_permissions("users:read")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).options(selectinload(User.roles).selectinload(Role.permissions))
    count = select(func.count()).select_from(User)
    if q:
        like = f"%{q.lower()}%"
        cond = (
            func.lower(User.email).like(like)
            | func.lower(User.username).like(like)
            | func.lower(func.coalesce(User.full_name, "")).like(like)
        )
        stmt, count = stmt.where(cond), count.where(cond)
    total = (await db.execute(count)).scalar_one()
    rows = (await db.execute(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset))).scalars()
    return UserPage(items=[UserOut.from_user(u) for u in rows], total=total, limit=limit, offset=offset)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    _: Principal = Depends(require_permissions("users:read")),
    db: AsyncSession = Depends(get_db),
):
    return UserOut.from_user(await _get_user_or_404(db, user_id))


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUpdateUserRequest,
    request: Request,
    principal: Principal = Depends(require_permissions("users:write")),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(db, user_id)
    changes = body.model_dump(exclude_unset=True)
    if user.id == principal.user.id and changes.get("is_active") is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes desactivarte a ti mismo")
    for field, value in changes.items():
        setattr(user, field, value)
    if changes.get("is_active") is False:
        await svc.revoke_all_user_tokens(db, user.id)
    audit(db, "user_updated", user_id=principal.user.id, request=request,
          target=user.id, changes=",".join(changes))
    await db.commit()
    return UserOut.from_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    principal: Principal = Depends(require_permissions("users:delete")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == principal.user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes eliminarte a ti mismo")
    user = await _get_user_or_404(db, user_id)
    await db.delete(user)
    audit(db, "user_deleted", user_id=principal.user.id, request=request, target=user_id)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{user_id}/roles/{role_id}", response_model=UserOut)
async def assign_role(
    user_id: uuid.UUID,
    role_id: int,
    request: Request,
    principal: Principal = Depends(require_permissions("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(db, user_id)
    role = await db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol no encontrado")
    if role not in user.roles:
        user.roles.append(role)
        audit(db, "role_assigned", user_id=principal.user.id, request=request,
              target=user.id, role=role.name)
        await db.commit()
    return UserOut.from_user(user)


@router.delete("/{user_id}/roles/{role_id}", response_model=UserOut)
async def remove_role(
    user_id: uuid.UUID,
    role_id: int,
    request: Request,
    principal: Principal = Depends(require_permissions("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_or_404(db, user_id)
    role = await db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol no encontrado")
    if user.id == principal.user.id and role.name == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes quitarte el rol admin")
    if role in user.roles:
        user.roles.remove(role)
        audit(db, "role_removed", user_id=principal.user.id, request=request,
              target=user.id, role=role.name)
        await db.commit()
    return UserOut.from_user(user)
