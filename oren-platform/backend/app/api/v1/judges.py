import uuid
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.judge import (
    JudgeAssignment, JudgeCategoryRecord, JudgeCategoryApplication,
    JudgeCategoryType, JudgeCategoryAppStatus
)
from app.models.competition import Competition
from app.models.user import User, RoleEnum
from app.schemas.judge import (
    JudgeAssignmentCreate, JudgeAssignmentResponse,
    JudgeCategoryRecordResponse, JudgeCategoryAppCreate,
    JudgeCategoryAppUpdate, JudgeCategoryAppResponse
)
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/judges", tags=["Судьи и судейская коллегия"])


@router.get("", response_model=list[dict])
async def list_judges(db: AsyncSession = Depends(get_db)):
    """List all judges with their current active category and statistics."""
    query = (
        select(User)
        .options(selectinload(User.roles), selectinload(User.judge_records), selectinload(User.organization))
        .join(User.roles)
        .where(User.roles.any(role=RoleEnum.JUDGE))
        .distinct()
    )
    res = await db.execute(query)
    judges = res.scalars().all()
    today = date.today()

    result = []
    for j in judges:
        active_cat = [r for r in j.judge_records if r.status == "active"]
        cat_rec = active_cat[0] if active_cat else None
        days_left = (cat_rec.valid_until - today).days if cat_rec else None

        result.append({
            "judge_id": j.id,
            "full_name": j.full_name,
            "organization_name": j.organization.name if j.organization else None,
            "municipality": j.municipality,
            "category": cat_rec.category.value if (cat_rec and hasattr(cat_rec.category, "value")) else (str(cat_rec.category) if cat_rec else "Без категории"),
            "valid_until": cat_rec.valid_until if cat_rec else None,
            "days_left": days_left,
            "is_expiring_soon": (days_left is not None and days_left <= 30)
        })
    return result


@router.get("/expiring", response_model=list[JudgeCategoryRecordResponse])
async def list_expiring_judge_categories(
    days: int = Query(30, description="Количество дней до истечения срока категории"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    today = date.today()
    threshold = today + timedelta(days=days)

    query = (
        select(JudgeCategoryRecord)
        .options(selectinload(JudgeCategoryRecord.judge))
        .where(
            JudgeCategoryRecord.status == "active",
            JudgeCategoryRecord.valid_until <= threshold
        )
        .order_by(JudgeCategoryRecord.valid_until.asc())
    )
    res = await db.execute(query)
    records = res.scalars().all()

    return [
        JudgeCategoryRecordResponse(
            id=r.id,
            judge_id=r.judge_id,
            judge_name=r.judge.full_name if r.judge else None,
            category=r.category,
            assigned_date=r.assigned_date,
            valid_until=r.valid_until,
            order_number=r.order_number,
            status="expired" if (r.valid_until - today).days < 0 else "active",
            days_left=(r.valid_until - today).days,
            is_expiring_soon=True
        )
        for r in records
    ]


@router.post("/assign", response_model=JudgeAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_judge_to_competition(
    data: JudgeAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    judge = await db.get(User, data.judge_id)
    if not judge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Судья не найден")

    comp = await db.get(Competition, data.competition_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    assignment = JudgeAssignment(
        judge_id=data.judge_id,
        competition_id=data.competition_id,
        position=data.position
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    return JudgeAssignmentResponse(
        id=assignment.id,
        judge_id=judge.id,
        judge_name=judge.full_name,
        competition_id=comp.id,
        competition_title=comp.title,
        position=assignment.position,
        created_at=assignment.created_at
    )


@router.get("/competitions/{comp_id}", response_model=list[JudgeAssignmentResponse])
async def list_competition_judges(comp_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(JudgeAssignment)
        .options(selectinload(JudgeAssignment.judge), selectinload(JudgeAssignment.competition))
        .where(JudgeAssignment.competition_id == comp_id)
    )
    res = await db.execute(query)
    assignments = res.scalars().all()

    return [
        JudgeAssignmentResponse(
            id=a.id,
            judge_id=a.judge_id,
            judge_name=a.judge.full_name if a.judge else None,
            competition_id=a.competition_id,
            competition_title=a.competition.title if a.competition else None,
            position=a.position,
            created_at=a.created_at
        )
        for a in assignments
    ]


@router.post("/category-apply", response_model=JudgeCategoryAppResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_category(
    data: JudgeCategoryAppCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    app_record = JudgeCategoryApplication(
        judge_id=current_user.id,
        requested_category=data.requested_category,
        application_type=data.application_type,
        status=JudgeCategoryAppStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return JudgeCategoryAppResponse(
        id=app_record.id,
        judge_id=current_user.id,
        judge_name=current_user.full_name,
        requested_category=app_record.requested_category,
        application_type=app_record.application_type,
        status=app_record.status,
        rejection_reason=None,
        submitted_at=app_record.submitted_at
    )


@router.get("/category-applications", response_model=list[JudgeCategoryAppResponse])
async def list_category_applications(
    status_filter: JudgeCategoryAppStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    query = select(JudgeCategoryApplication).options(selectinload(JudgeCategoryApplication.judge))
    if status_filter:
        query = query.where(JudgeCategoryApplication.status == status_filter)

    query = query.order_by(JudgeCategoryApplication.submitted_at.desc())
    res = await db.execute(query)
    apps = res.scalars().all()

    return [
        JudgeCategoryAppResponse(
            id=a.id,
            judge_id=a.judge_id,
            judge_name=a.judge.full_name if a.judge else None,
            requested_category=a.requested_category,
            application_type=a.application_type,
            status=a.status,
            rejection_reason=a.rejection_reason,
            submitted_at=a.submitted_at,
            reviewed_at=a.reviewed_at
        )
        for a in apps
    ]


@router.patch("/category-applications/{app_id}", response_model=JudgeCategoryAppResponse)
async def review_category_application(
    app_id: uuid.UUID,
    data: JudgeCategoryAppUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _role=Depends(require_role([RoleEnum.FEDERATION]))
):
    query = (
        select(JudgeCategoryApplication)
        .options(selectinload(JudgeCategoryApplication.judge))
        .where(JudgeCategoryApplication.id == app_id)
    )
    res = await db.execute(query)
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")

    app_rec.status = data.status
    app_rec.rejection_reason = data.rejection_reason if data.status == JudgeCategoryAppStatus.REJECTED else None
    app_rec.reviewed_at = datetime.utcnow()
    app_rec.reviewed_by = current_user.id

    if data.status == JudgeCategoryAppStatus.APPROVED:
        assign_d = data.assigned_date or date.today()
        # Judge categories typically valid for 2 years
        valid_until = data.valid_until or (assign_d + relativedelta(years=2))

        cat_rec = JudgeCategoryRecord(
            judge_id=app_rec.judge_id,
            category=app_rec.requested_category,
            assigned_date=assign_d,
            valid_until=valid_until,
            order_number=data.order_number or "б/н",
            status="active"
        )
        db.add(cat_rec)

    await db.commit()
    await db.refresh(app_rec)

    return JudgeCategoryAppResponse(
        id=app_rec.id,
        judge_id=app_rec.judge_id,
        judge_name=app_rec.judge.full_name if app_rec.judge else None,
        requested_category=app_rec.requested_category,
        application_type=app_rec.application_type,
        status=app_rec.status,
        rejection_reason=app_rec.rejection_reason,
        submitted_at=app_rec.submitted_at,
        reviewed_at=app_rec.reviewed_at
    )
