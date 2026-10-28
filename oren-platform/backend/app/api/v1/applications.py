import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.models.competition import Competition, CompetitionStatus
from app.models.user import User, RoleEnum
from app.schemas.application import ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse
from app.api.deps import get_current_user, get_active_role, require_role
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/applications", tags=["Заявки на участие в соревнованиях"])


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def submit_application(
    data: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    active_role: str = Depends(get_active_role),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch competition
    comp = await db.get(Competition, data.competition_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    # 2. Check competition status & registration deadline
    if comp.status != CompetitionStatus.REGISTRATION_OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Прием заявок закрыт (текущий статус соревнования: '{comp.status.value}')"
        )
    if comp.registration_deadline and datetime.utcnow() > comp.registration_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок подачи заявок на данное соревнование истек"
        )

    # 3. Determine target athlete
    if active_role == RoleEnum.ATHLETE.value or data.athlete_id is None:
        target_athlete_id = current_user.id
        athlete = current_user
    else:
        # Coach submitting for an athlete
        if active_role != RoleEnum.COACH.value and active_role != RoleEnum.FEDERATION.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Подавать заявку за другого спортсмена может только тренер или федерация"
            )
        target_athlete_id = data.athlete_id
        q_ath = select(User).options(selectinload(User.organization)).where(User.id == target_athlete_id)
        res_ath = await db.execute(q_ath)
        athlete = res_ath.scalar_one_or_none()
        if not athlete:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Спортсмен не найден")

    # 4. Check athlete age restrictions
    if athlete.birth_date:
        today = date.today()
        age = today.year - athlete.birth_date.year - ((today.month, today.day) < (athlete.birth_date.month, athlete.birth_date.day))
        if comp.min_age and age < comp.min_age:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Возраст спортсмена ({age} лет) меньше минимально допустимого ({comp.min_age} лет)"
            )
        if comp.max_age and age > comp.max_age:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Возраст спортсмена ({age} лет) превышает максимально допустимый ({comp.max_age} лет)"
            )

    # 5. Check duplicate application
    dup_q = select(Application).where(
        Application.competition_id == comp.id,
        Application.athlete_id == target_athlete_id,
        Application.status.in_([ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED, ApplicationStatus.UNDER_REVIEW])
    )
    dup_res = await db.execute(dup_q)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заявка на это соревнование для данного спортсмена уже подана"
        )

    # 6. Create application
    app_record = Application(
        competition_id=comp.id,
        athlete_id=target_athlete_id,
        submitted_by=current_user.id,
        status=ApplicationStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return ApplicationResponse(
        id=app_record.id,
        athlete_id=athlete.id,
        athlete_name=athlete.full_name,
        athlete_birth_date=athlete.birth_date,
        athlete_organization=athlete.organization.name if athlete.organization else None,
        athlete_municipality=athlete.municipality,
        competition_id=comp.id,
        competition_title=comp.title,
        submitted_by=current_user.id,
        submitted_by_name=current_user.full_name,
        status=app_record.status,
        rejection_reason=None,
        submitted_at=app_record.submitted_at,
    )


@router.get("/competition/{comp_id}", response_model=list[ApplicationResponse])
async def list_competition_applications(
    comp_id: uuid.UUID,
    status_filter: ApplicationStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION, RoleEnum.COACH]))
):
    query = (
        select(Application)
        .options(
            selectinload(Application.athlete).selectinload(User.organization),
            selectinload(Application.submitter),
            selectinload(Application.competition)
        )
        .where(Application.competition_id == comp_id)
    )
    if status_filter:
        query = query.where(Application.status == status_filter)

    query = query.order_by(Application.submitted_at.desc())
    res = await db.execute(query)
    apps = res.scalars().all()

    return [
        ApplicationResponse(
            id=a.id,
            athlete_id=a.athlete_id,
            athlete_name=a.athlete.full_name if a.athlete else None,
            athlete_birth_date=a.athlete.birth_date if a.athlete else None,
            athlete_organization=a.athlete.organization.name if a.athlete and a.athlete.organization else None,
            athlete_municipality=a.athlete.municipality if a.athlete else None,
            competition_id=a.competition_id,
            competition_title=a.competition.title if a.competition else None,
            submitted_by=a.submitted_by,
            submitted_by_name=a.submitter.full_name if a.submitter else None,
            status=a.status,
            rejection_reason=a.rejection_reason,
            submitted_at=a.submitted_at,
            reviewed_at=a.reviewed_at,
            reviewed_by=a.reviewed_by,
        )
        for a in apps
    ]


@router.get("/my", response_model=list[ApplicationResponse])
async def list_my_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Application)
        .options(
            selectinload(Application.athlete).selectinload(User.organization),
            selectinload(Application.submitter),
            selectinload(Application.competition)
        )
        .where(
            (Application.athlete_id == current_user.id) | (Application.submitted_by == current_user.id)
        )
        .order_by(Application.submitted_at.desc())
    )
    res = await db.execute(query)
    apps = res.scalars().all()

    return [
        ApplicationResponse(
            id=a.id,
            athlete_id=a.athlete_id,
            athlete_name=a.athlete.full_name if a.athlete else None,
            athlete_birth_date=a.athlete.birth_date if a.athlete else None,
            athlete_organization=a.athlete.organization.name if a.athlete and a.athlete.organization else None,
            athlete_municipality=a.athlete.municipality if a.athlete else None,
            competition_id=a.competition_id,
            competition_title=a.competition.title if a.competition else None,
            submitted_by=a.submitted_by,
            submitted_by_name=a.submitter.full_name if a.submitter else None,
            status=a.status,
            rejection_reason=a.rejection_reason,
            submitted_at=a.submitted_at,
            reviewed_at=a.reviewed_at,
            reviewed_by=a.reviewed_by,
        )
        for a in apps
    ]


@router.patch("/{app_id}/status", response_model=ApplicationResponse)
async def moderate_application(
    app_id: uuid.UUID,
    data: ApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _role=Depends(require_role([RoleEnum.FEDERATION]))
):
    query = (
        select(Application)
        .options(
            selectinload(Application.athlete).selectinload(User.organization),
            selectinload(Application.submitter),
            selectinload(Application.competition)
        )
        .where(Application.id == app_id)
    )
    res = await db.execute(query)
    app_record = res.scalar_one_or_none()
    if not app_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")

    app_record.status = data.status
    app_record.rejection_reason = data.rejection_reason if data.status == ApplicationStatus.REJECTED else None
    app_record.reviewed_at = datetime.utcnow()
    app_record.reviewed_by = current_user.id

    await db.commit()
    await db.refresh(app_record)

    # Send notification
    comp_title = app_record.competition.title if app_record.competition else "Соревнование"
    await NotificationService.notify_application_status(
        db=db,
        user_id=app_record.athlete_id,
        competition_title=comp_title,
        status=data.status.value,
        rejection_reason=data.rejection_reason
    )

    return ApplicationResponse(
        id=app_record.id,
        athlete_id=app_record.athlete_id,
        athlete_name=app_record.athlete.full_name if app_record.athlete else None,
        athlete_birth_date=app_record.athlete.birth_date if app_record.athlete else None,
        athlete_organization=app_record.athlete.organization.name if app_record.athlete and app_record.athlete.organization else None,
        athlete_municipality=app_record.athlete.municipality if app_record.athlete else None,
        competition_id=app_record.competition_id,
        competition_title=comp_title,
        submitted_by=app_record.submitted_by,
        submitted_by_name=app_record.submitter.full_name if app_record.submitter else None,
        status=app_record.status,
        rejection_reason=app_record.rejection_reason,
        submitted_at=app_record.submitted_at,
        reviewed_at=app_record.reviewed_at,
        reviewed_by=app_record.reviewed_by,
    )
