from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import Principal, get_principal
from app.models import EmailVerification, PasswordReset, RefreshToken, Role, User
from app.schemas import (
    ChangePasswordRequest,
    EmailRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenPair,
    TokenRequest,
    UserOut,
)
from app.security import sha256_hex, verify_password
from app.services import auth_service as svc
from app.services.audit import audit

router = APIRouter(prefix="/auth", tags=["auth"])

GENERIC_OK = "Si el correo existe, se enviaron instrucciones."


async def _login(db: AsyncSession, identifier: str, password: str, request: Request) -> TokenPair:
    user = await svc.authenticate(db, identifier, password, request)
    pair, _ = await svc.issue_tokens(db, user, request)
    audit(db, "login", user_id=user.id, request=request)
    await db.commit()
    return pair


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    s = get_settings()
    email, username = body.email.lower(), body.username.lower()

    taken = await db.execute(
        select(User.id).where(or_(User.email == email, User.username == username))
    )
    if taken.first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email o username ya registrado")

    role = (await db.execute(select(Role).where(Role.name == "user"))).scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Rol 'user' no configurado")

    user = User(
        email=email,
        username=username,
        full_name=body.full_name,
        password_hash=await svc.hash_password_async(body.password),
        is_verified=False,
        roles=[role],
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email o username ya registrado")

    token = await svc.create_one_time_token(
        db, EmailVerification, user.id, timedelta(hours=s.email_verification_hours)
    )
    audit(db, "register", user_id=user.id, request=request)
    await db.commit()
    return RegisterResponse(
        user=UserOut.from_user(user),
        dev_verification_token=token if s.dev_expose_tokens else None,
    )


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await _login(db, body.identifier, body.password, request)


@router.post("/token", response_model=TokenPair, include_in_schema=True,
             summary="Login OAuth2 (form) — usado por el botón Authorize de Swagger")
async def login_form(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    return await _login(db, form.username, form.password, request)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    return await svc.rotate_refresh_token(db, body.refresh_token, request)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    body: LogoutRequest | None = None,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    await svc.blacklist_access_token(db, principal.jti, principal.user.id, principal.exp, "logout")
    if body and body.refresh_token:
        row = (
            await db.execute(
                select(RefreshToken).where(
                    RefreshToken.token_hash == sha256_hex(body.refresh_token),
                    RefreshToken.user_id == principal.user.id,
                )
            )
        ).scalar_one_or_none()
        if row is not None:
            await svc.revoke_family(db, row.family_id)
    audit(db, "logout", user_id=principal.user.id, request=request)
    await db.commit()
    return MessageResponse(detail="Sesión cerrada")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(
    request: Request,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    await svc.blacklist_access_token(db, principal.jti, principal.user.id, principal.exp, "logout_all")
    await svc.revoke_all_user_tokens(db, principal.user.id)
    audit(db, "logout_all", user_id=principal.user.id, request=request)
    await db.commit()
    return MessageResponse(detail="Todas las sesiones fueron cerradas")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(body: TokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = await svc.consume_one_time_token(db, EmailVerification, body.token)
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token inválido o expirado")
    user = await db.get(User, user_id)
    user.is_verified = True
    audit(db, "email_verified", user_id=user_id, request=request)
    await db.commit()
    return MessageResponse(detail="Email verificado")


@router.post("/resend-verification", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(body: EmailRequest, db: AsyncSession = Depends(get_db)):
    s = get_settings()
    user = await svc.get_user_by_identifier(db, body.email)
    token = None
    if user is not None and user.is_active and not user.is_verified:
        token = await svc.create_one_time_token(
            db, EmailVerification, user.id, timedelta(hours=s.email_verification_hours)
        )
        await db.commit()
        # TODO: enviar el token por email con tu proveedor (SES, SendGrid, Resend...)
    return MessageResponse(detail=GENERIC_OK, dev_token=token if s.dev_expose_tokens else None)


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(body: EmailRequest, request: Request, db: AsyncSession = Depends(get_db)):
    s = get_settings()
    user = await svc.get_user_by_identifier(db, body.email)
    token = None
    if user is not None and user.is_active:
        token = await svc.create_one_time_token(
            db, PasswordReset, user.id, timedelta(minutes=s.password_reset_minutes)
        )
        audit(db, "password_reset_requested", user_id=user.id, request=request)
        await db.commit()
        # TODO: enviar el token por email con tu proveedor
    return MessageResponse(detail=GENERIC_OK, dev_token=token if s.dev_expose_tokens else None)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = await svc.consume_one_time_token(db, PasswordReset, body.token)
    if user_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token inválido o expirado")
    user = await db.get(User, user_id)
    user.password_hash = await svc.hash_password_async(body.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await svc.revoke_all_user_tokens(db, user_id)
    audit(db, "password_reset_completed", user_id=user_id, request=request)
    await db.commit()
    return MessageResponse(detail="Contraseña actualizada. Inicia sesión de nuevo.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    db: AsyncSession = Depends(get_db),
):
    user = principal.user
    if not await run_in_threadpool(verify_password, body.current_password, user.password_hash):
        audit(db, "change_password_failed", user_id=user.id, success=False, request=request)
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual es incorrecta")
    user.password_hash = await svc.hash_password_async(body.new_password)
    await svc.revoke_all_user_tokens(db, user.id)
    await svc.blacklist_access_token(db, principal.jti, user.id, principal.exp, "password_changed")
    audit(db, "password_changed", user_id=user.id, request=request)
    await db.commit()
    return MessageResponse(detail="Contraseña actualizada. Inicia sesión de nuevo.")
