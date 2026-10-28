import uuid
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.rank import RankRecord, RankApplication, RankType, RankApplicationStatus
from app.models.competition import Competition, CompetitionLevel
from app.models.result import Result
from app.models.user import User, RoleEnum
from app.schemas.rank import (
    RankRecordResponse, RankApplicationCreate, RankApplicationUpdate,
    RankApplicationResponse, EvskCheckResponse
)
from app.services.evsk_service import EvskService
from app.services.notification_service import NotificationService
from app.api.deps import get_current_user, get_active_role, require_role

router = APIRouter(prefix="/ranks", tags=["Спортивные разряды и ЕВСК"])


@router.get("/expiring", response_model=list[RankRecordResponse])
async def get_expiring_ranks(
    days: int = Query(30, description="Количество дней до истечения срока"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION, RoleEnum.COACH]))
):
    today = date.today()
    threshold = today + timedelta(days=days)

    query = (
        select(RankRecord)
        .options(selectinload(RankRecord.athlete))
        .where(
            RankRecord.status == "active",
            RankRecord.valid_until.is_not(None),
            RankRecord.valid_until <= threshold
        )
        .order_by(RankRecord.valid_until.asc())
    )
    res = await db.execute(query)
    records = res.scalars().all()

    response = []
    for r in records:
        days_left = (r.valid_until - today).days if r.valid_until else None
        response.append(
            RankRecordResponse(
                id=r.id,
                athlete_id=r.athlete_id,
                athlete_name=r.athlete.full_name if r.athlete else None,
                rank=r.rank,
                assigned_date=r.assigned_date,
                order_number=r.order_number,
                valid_until=r.valid_until,
                status="expired" if days_left and days_left < 0 else "active",
                days_left=days_left,
                is_expiring_soon=True
            )
        )
    return response


@router.get("/evsk-check", response_model=EvskCheckResponse)
async def check_evsk_eligibility(
    competition_level: CompetitionLevel = Query(..., description="Уровень соревнования"),
    place: int = Query(..., description="Занятое место")
):
    result = EvskService.check_evsk_eligibility(competition_level, place)
    return EvskCheckResponse(
        eligible=result["eligible"],
        recommended_rank=result["recommended_rank"],
        reason=result["reason"]
    )


@router.post("/apply", response_model=RankApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_rank(
    data: RankApplicationCreate,
    current_user: User = Depends(get_current_user),
    active_role: str = Depends(get_active_role),
    db: AsyncSession = Depends(get_db)
):
    # Target athlete
    target_athlete_id = data.athlete_id if (data.athlete_id and active_role in [RoleEnum.COACH.value, RoleEnum.FEDERATION.value]) else current_user.id

    # Verify competition and result
    comp = await db.get(Competition, data.competition_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    res = await db.get(Result, data.result_id)
    if not res or res.competition_id != data.competition_id or res.athlete_id != target_athlete_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Результат соревнования не соответствует спортсмену")

    app_record = RankApplication(
        athlete_id=target_athlete_id,
        submitted_by=current_user.id,
        requested_rank=data.requested_rank,
        competition_id=data.competition_id,
        result_id=data.result_id,
        status=RankApplicationStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    athlete = await db.get(User, target_athlete_id)

    return RankApplicationResponse(
        id=app_record.id,
        athlete_id=target_athlete_id,
        athlete_name=athlete.full_name if athlete else None,
        submitted_by=current_user.id,
        submitted_by_name=current_user.full_name,
        requested_rank=app_record.requested_rank,
        competition_id=comp.id,
        competition_title=comp.title,
        result_id=res.id,
        result_place=res.place,
        status=app_record.status,
        rejection_reason=None,
        submitted_at=app_record.submitted_at
    )


@router.get("/applications", response_model=list[RankApplicationResponse])
async def list_rank_applications(
    status_filter: RankApplicationStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION, RoleEnum.COACH]))
):
    query = (
        select(RankApplication)
        .options(
            selectinload(RankApplication.athlete),
            selectinload(RankApplication.submitter),
            selectinload(RankApplication.competition),
            selectinload(RankApplication.result)
        )
    )
    if status_filter:
        query = query.where(RankApplication.status == status_filter)

    query = query.order_by(RankApplication.submitted_at.desc())
    res = await db.execute(query)
    apps = res.scalars().all()

    return [
        RankApplicationResponse(
            id=a.id,
            athlete_id=a.athlete_id,
            athlete_name=a.athlete.full_name if a.athlete else None,
            submitted_by=a.submitted_by,
            submitted_by_name=a.submitter.full_name if a.submitter else None,
            requested_rank=a.requested_rank,
            competition_id=a.competition_id,
            competition_title=a.competition.title if a.competition else None,
            result_id=a.result_id,
            result_place=a.result.place if a.result else None,
            status=a.status,
            rejection_reason=a.rejection_reason,
            submitted_at=a.submitted_at,
            reviewed_at=a.reviewed_at
        )
        for a in apps
    ]


@router.patch("/applications/{app_id}", response_model=RankApplicationResponse)
async def review_rank_application(
    app_id: uuid.UUID,
    data: RankApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _role=Depends(require_role([RoleEnum.FEDERATION]))
):
    query = (
        select(RankApplication)
        .options(
            selectinload(RankApplication.athlete),
            selectinload(RankApplication.submitter),
            selectinload(RankApplication.competition),
            selectinload(RankApplication.result)
        )
        .where(RankApplication.id == app_id)
    )
    res = await db.execute(query)
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка на разряд не найдена")

    app_rec.status = data.status
    app_rec.rejection_reason = data.rejection_reason if data.status == RankApplicationStatus.REJECTED else None
    app_rec.reviewed_at = datetime.utcnow()
    app_rec.reviewed_by = current_user.id

    # If approved, create or update RankRecord
    if data.status == RankApplicationStatus.APPROVED:
        assign_d = data.assigned_date or date.today()
        valid_until = EvskService.calculate_validity_date(app_rec.requested_rank, assign_d)

        rank_record = RankRecord(
            athlete_id=app_rec.athlete_id,
            rank=app_rec.requested_rank,
            assigned_date=assign_d,
            order_number=data.order_number or "б/н",
            valid_until=valid_until,
            status="active"
        )
        db.add(rank_record)

    await db.commit()
    await db.refresh(app_rec)

    # Send notification
    await NotificationService.notify_rank_status(
        db=db,
        user_id=app_rec.athlete_id,
        rank_name=app_rec.requested_rank.value if hasattr(app_rec.requested_rank, "value") else str(app_rec.requested_rank),
        status=data.status.value,
        order_number=data.order_number
    )

    return RankApplicationResponse(
        id=app_rec.id,
        athlete_id=app_rec.athlete_id,
        athlete_name=app_rec.athlete.full_name if app_rec.athlete else None,
        submitted_by=app_rec.submitted_by,
        submitted_by_name=app_rec.submitter.full_name if app_rec.submitter else None,
        requested_rank=app_rec.requested_rank,
        competition_id=app_rec.competition_id,
        competition_title=app_rec.competition.title if app_rec.competition else None,
        result_id=app_rec.result_id,
        result_place=app_rec.result.place if app_rec.result else None,
        status=app_rec.status,
        rejection_reason=app_rec.rejection_reason,
        submitted_at=app_rec.submitted_at,
        reviewed_at=app_rec.reviewed_at
    )


@router.get("/athlete/{athlete_id}", response_model=list[RankRecordResponse])
async def get_athlete_ranks(athlete_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    q = (
        select(RankRecord)
        .options(selectinload(RankRecord.athlete))
        .where(RankRecord.athlete_id == athlete_id)
        .order_by(RankRecord.assigned_date.desc())
    )
    res = await db.execute(q)
    records = res.scalars().all()
    today = date.today()

    return [
        RankRecordResponse(
            id=r.id,
            athlete_id=r.athlete_id,
            athlete_name=r.athlete.full_name if r.athlete else None,
            rank=r.rank,
            assigned_date=r.assigned_date,
            order_number=r.order_number,
            valid_until=r.valid_until,
            status=r.status,
            days_left=(r.valid_until - today).days if r.valid_until else None,
            is_expiring_soon=((r.valid_until - today).days <= 30) if r.valid_until else False
        )
        for r in records
    ]
