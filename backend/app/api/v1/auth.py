import uuid
from typing import Annotated
from datetime import timedelta, date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole, RoleEnum
from app.models.organization import Organization
from app.schemas.auth import (
    UserLoginRequest, TokenResponse, UserRegisterRequest,
    UserResponse, UserUpdateRequest, RoleSwitchRequest
)
from app.utils.security import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user, get_active_role

router = APIRouter(prefix="/auth", tags=["Аутентификация"])
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    data: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    # Check if email is already taken
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован",
        )

    # Check organization if provided
    if data.organization_id:
        org = await db.get(Organization, data.organization_id)
        if not org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Указанная организация не найдена",
            )

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        birth_date=data.birth_date,
        municipality=data.municipality,
        phone=data.phone,
        organization_id=data.organization_id,
        year_started=data.year_started,
        sport_preparation_stage=data.sport_preparation_stage,
        anti_doping_completed=data.anti_doping_completed,
        anti_doping_date=data.anti_doping_date,
        pd_consent=data.pd_consent,
        pd_consent_date=datetime.utcnow() if data.pd_consent else None,
        legal_rep_name=data.legal_rep_name,
        legal_rep_phone=data.legal_rep_phone,
        legal_rep_email=data.legal_rep_email,
    )
    db.add(user)
    await db.flush()

    # Assign roles
    roles_to_assign = data.roles if data.roles else [RoleEnum.ATHLETE]
    for r in roles_to_assign:
        user_role = UserRole(user_id=user.id, role=r)
        db.add(user_role)

    await db.commit()

    # Reload user with relationships
    q = select(User).options(selectinload(User.roles), selectinload(User.organization)).where(User.id == user.id)
    res = await db.execute(q)
    created_user = res.scalar_one()

    roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in created_user.roles]
    return UserResponse(
        id=created_user.id,
        email=created_user.email,
        full_name=created_user.full_name,
        roles=roles_str,
        active_role=roles_str[0] if roles_str else None,
        birth_date=created_user.birth_date,
        municipality=created_user.municipality,
        phone=created_user.phone,
        organization_id=created_user.organization_id,
        organization_name=created_user.organization.name if created_user.organization else None,
        year_started=created_user.year_started,
        sport_preparation_stage=created_user.sport_preparation_stage,
        anti_doping_completed=created_user.anti_doping_completed,
        anti_doping_date=created_user.anti_doping_date,
        pd_consent=created_user.pd_consent,
        legal_rep_name=created_user.legal_rep_name,
        legal_rep_phone=created_user.legal_rep_phone,
        legal_rep_email=created_user.legal_rep_email,
        is_disqualified=created_user.is_disqualified,
        disqualification_reason=created_user.disqualification_reason,
        disqualification_until=created_user.disqualification_until,
        created_at=created_user.created_at
    )


@router.post("/login", response_model=TokenResponse)
async def login_user(
    data: UserLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    q = select(User).options(selectinload(User.roles)).where(User.email == data.email.lower())
    res = await db.execute(q)
    user = res.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in user.roles]
    active_role = RoleEnum.FEDERATION.value if RoleEnum.FEDERATION.value in roles_str else (roles_str[0] if roles_str else "athlete")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": roles_str, "active_role": active_role},
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=roles_str,
        active_role=active_role
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    active_role: Annotated[str, Depends(get_active_role)]
):
    roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in current_user.roles]
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles=roles_str,
        active_role=active_role,
        birth_date=current_user.birth_date,
        municipality=current_user.municipality,
        phone=current_user.phone,
        organization_id=current_user.organization_id,
        organization_name=current_user.organization.name if current_user.organization else None,
        year_started=current_user.year_started,
        sport_preparation_stage=current_user.sport_preparation_stage,
        anti_doping_completed=current_user.anti_doping_completed,
        anti_doping_date=current_user.anti_doping_date,
        pd_consent=current_user.pd_consent,
        legal_rep_name=current_user.legal_rep_name,
        legal_rep_phone=current_user.legal_rep_phone,
        legal_rep_email=current_user.legal_rep_email,
        is_disqualified=current_user.is_disqualified,
        disqualification_reason=current_user.disqualification_reason,
        disqualification_until=current_user.disqualification_until,
        created_at=current_user.created_at
    )


@router.post("/switch-role", response_model=TokenResponse)
async def switch_role(
    data: RoleSwitchRequest,
    current_user: Annotated[User, Depends(get_current_user)]
):
    roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in current_user.roles]
    target_role = data.role.value if hasattr(data.role, "value") else str(data.role)

    if target_role not in roles_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"У вас нет роли '{target_role}'. Ваши роли: {roles_str}"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": str(current_user.id), "email": current_user.email, "roles": roles_str, "active_role": target_role},
        expires_delta=access_token_expires
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles=roles_str,
        active_role=target_role
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    active_role: Annotated[str, Depends(get_active_role)],
    db: AsyncSession = Depends(get_db)
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.birth_date is not None:
        current_user.birth_date = data.birth_date
    if data.municipality is not None:
        current_user.municipality = data.municipality
    if data.phone is not None:
        current_user.phone = data.phone
    if data.organization_id is not None:
        current_user.organization_id = data.organization_id
    if data.year_started is not None:
        current_user.year_started = data.year_started
    if data.sport_preparation_stage is not None:
        current_user.sport_preparation_stage = data.sport_preparation_stage
    if data.anti_doping_completed is not None:
        current_user.anti_doping_completed = data.anti_doping_completed
    if data.anti_doping_date is not None:
        current_user.anti_doping_date = data.anti_doping_date
    if data.pd_consent is not None:
        current_user.pd_consent = data.pd_consent
        if data.pd_consent and not current_user.pd_consent_date:
            current_user.pd_consent_date = datetime.utcnow()
    if data.legal_rep_name is not None:
        current_user.legal_rep_name = data.legal_rep_name
    if data.legal_rep_phone is not None:
        current_user.legal_rep_phone = data.legal_rep_phone
    if data.legal_rep_email is not None:
        current_user.legal_rep_email = data.legal_rep_email

    # Disqualification flags can only be modified by federation
    if (data.is_disqualified is not None or data.disqualification_until is not None) and active_role == RoleEnum.FEDERATION.value:
        if data.is_disqualified is not None:
            current_user.is_disqualified = data.is_disqualified
        if data.disqualification_reason is not None:
            current_user.disqualification_reason = data.disqualification_reason
        if data.disqualification_until is not None:
            current_user.disqualification_until = data.disqualification_until

    await db.commit()
    await db.refresh(current_user)

    roles_str = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in current_user.roles]
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles=roles_str,
        active_role=active_role,
        birth_date=current_user.birth_date,
        municipality=current_user.municipality,
        phone=current_user.phone,
        organization_id=current_user.organization_id,
        organization_name=current_user.organization.name if current_user.organization else None,
        year_started=current_user.year_started,
        sport_preparation_stage=current_user.sport_preparation_stage,
        anti_doping_completed=current_user.anti_doping_completed,
        anti_doping_date=current_user.anti_doping_date,
        pd_consent=current_user.pd_consent,
        legal_rep_name=current_user.legal_rep_name,
        legal_rep_phone=current_user.legal_rep_phone,
        legal_rep_email=current_user.legal_rep_email,
        is_disqualified=current_user.is_disqualified,
        disqualification_reason=current_user.disqualification_reason,
        disqualification_until=current_user.disqualification_until,
        created_at=current_user.created_at
    )
