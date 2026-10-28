import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole, RoleEnum
from app.models.coach_athlete import CoachAthlete, CoachAthleteStatus
from app.models.audit import AuditLog
from app.schemas.user import (
    UserRead, UserUpdate, DisqualificationUpdate,
    CoachAthleteRead, CoachAthleteCreate,
    RoleRequestRead, RoleRejectRequest
)
from app.services.notification_service import NotificationService
from app.api.deps import get_current_user, require_federation, require_coach

router = APIRouter(prefix="/users", tags=["Пользователи и Реестр"])


@router.get("/role-requests", response_model=List[RoleRequestRead])
async def list_role_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_federation)
):
    query = (
        select(UserRole)
        .options(selectinload(UserRole.user).selectinload(User.organization))
        .order_by(UserRole.requested_at.desc())
    )
    if status_filter:
        query = query.where(UserRole.status == status_filter)

    result = await db.execute(query)
    roles = result.scalars().all()

    items = []
    for ur in roles:
        u = ur.user
        if not u:
            continue
        role_val = ur.role.value if hasattr(ur.role, "value") else str(ur.role)
        items.append(
            RoleRequestRead(
                id=ur.id,
                user_id=u.id,
                user_name=u.full_name,
                user_email=u.email,
                role=role_val,
                status=ur.status,
                requested_at=ur.requested_at,
                reviewed_at=ur.reviewed_at,
                rejection_reason=ur.rejection_reason,
                organization_name=u.organization.name if u.organization else None,
                municipality=u.municipality,
                phone=u.phone
            )
        )
    return items


@router.post("/role-requests/{role_id}/approve")
async def approve_role_request(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_federation)
):
    res = await db.execute(
        select(UserRole).options(selectinload(UserRole.user)).where(UserRole.id == role_id)
    )
    user_role = res.scalar_one_or_none()
    if not user_role:
        raise HTTPException(status_code=404, detail="Заявка на роль не найдена")

    user_role.status = "approved"
    user_role.reviewed_at = datetime.utcnow()
    user_role.rejection_reason = None

    role_val = user_role.role.value if hasattr(user_role.role, "value") else str(user_role.role)

    # Audit log
    audit = AuditLog(
        user_id=admin.id,
        action="role_approved",
        entity_type="user_role",
        entity_id=str(user_role.id),
        details={"user_id": str(user_role.user_id), "role": role_val}
    )
    db.add(audit)

    await db.commit()

    # Deliver notification to user
    await NotificationService.notify_role_status(
        db=db,
        user_id=user_role.user_id,
        role=role_val,
        status="approved"
    )

    return {"status": "approved", "role_id": str(role_id), "message": "Роль успешно утверждена"}


@router.post("/role-requests/{role_id}/reject")
async def reject_role_request(
    role_id: uuid.UUID,
    req: RoleRejectRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_federation)
):
    res = await db.execute(
        select(UserRole).options(selectinload(UserRole.user)).where(UserRole.id == role_id)
    )
    user_role = res.scalar_one_or_none()
    if not user_role:
        raise HTTPException(status_code=404, detail="Заявка на роль не найдена")

    user_role.status = "rejected"
    user_role.reviewed_at = datetime.utcnow()
    user_role.rejection_reason = req.reason

    role_val = user_role.role.value if hasattr(user_role.role, "value") else str(user_role.role)

    # Audit log
    audit = AuditLog(
        user_id=admin.id,
        action="role_rejected",
        entity_type="user_role",
        entity_id=str(user_role.id),
        details={"user_id": str(user_role.user_id), "role": role_val, "reason": req.reason}
    )
    db.add(audit)

    await db.commit()

    # Deliver notification to user
    await NotificationService.notify_role_status(
        db=db,
        user_id=user_role.user_id,
        role=role_val,
        status="rejected",
        rejection_reason=req.reason
    )

    return {"status": "rejected", "role_id": str(role_id), "message": "Заявка на роль отклонена"}


@router.get("", response_model=List[UserRead])
async def list_users(
    role: Optional[str] = None,
    municipality: Optional[str] = None,
    organization_id: Optional[uuid.UUID] = None,
    is_disqualified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(User).options(selectinload(User.roles), selectinload(User.organization))
    filters = []

    if role:
        query = query.join(User.roles).where(UserRole.role == role)
    if municipality:
        filters.append(User.municipality == municipality)
    if organization_id:
        filters.append(User.organization_id == organization_id)
    if is_disqualified is not None:
        filters.append(User.is_disqualified == is_disqualified)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(User.full_name.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserRead)
async def get_user_by_id(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles), selectinload(User.organization))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only self or federation can update
    is_admin = RoleEnum.FEDERATION.value in current_user.available_roles
    if current_user.id != user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Запрещено редактировать чужой профиль")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    update_data = req.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(user, field, val)

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/disqualification", response_model=UserRead)
async def update_disqualification(
    user_id: uuid.UUID,
    req: DisqualificationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_federation)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.is_disqualified = req.is_disqualified
    user.disqualification_reason = req.disqualification_reason
    user.disqualification_until = req.disqualification_until

    # Log in audit
    audit = AuditLog(
        user_id=admin.id,
        action="disqualification_update",
        entity_type="user",
        entity_id=str(user.id),
        details={
            "is_disqualified": req.is_disqualified,
            "reason": req.disqualification_reason,
            "until": req.disqualification_until.isoformat() if req.disqualification_until else None
        }
    )
    db.add(audit)

    await db.commit()
    await db.refresh(user)
    return user


# Coach - Athlete links
@router.get("/coach/my-athletes", response_model=List[CoachAthleteRead])
async def get_my_athletes(
    db: AsyncSession = Depends(get_db),
    coach: User = Depends(require_coach)
):
    result = await db.execute(
        select(CoachAthlete)
        .options(
            selectinload(CoachAthlete.coach),
            selectinload(CoachAthlete.athlete),
            selectinload(CoachAthlete.discipline)
        )
        .where(CoachAthlete.coach_id == coach.id)
    )
    return result.scalars().all()


@router.post("/coach/link-athlete", response_model=CoachAthleteRead)
async def link_athlete(
    req: CoachAthleteCreate,
    db: AsyncSession = Depends(get_db),
    coach: User = Depends(require_coach)
):
    # Verify athlete exists
    ath_res = await db.execute(select(User).where(User.id == req.athlete_id))
    athlete = ath_res.scalar_one_or_none()
    if not athlete:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")

    # Check existing link
    exist_res = await db.execute(
        select(CoachAthlete).where(
            CoachAthlete.coach_id == coach.id,
            CoachAthlete.athlete_id == req.athlete_id,
            CoachAthlete.discipline_id == req.discipline_id
        )
    )
    if exist_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Связь с данным спортсменом по этой дисциплине уже создана")

    link = CoachAthlete(
        coach_id=coach.id,
        athlete_id=req.athlete_id,
        discipline_id=req.discipline_id,
        status=CoachAthleteStatus.ACTIVE  # Can be accepted immediately or pending
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link
