import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.competition import (
    Competition, CompetitionType, CalendarPlan,
    CompetitionStatus, CompetitionFormat, CompetitionLevel
)
from app.models.discipline import Discipline
from app.models.application import Application
from app.models.result import Result
from app.models.user import RoleEnum
from app.schemas.competition import (
    CompetitionCreate, CompetitionUpdate, CompetitionResponse,
    CompetitionTypeCreate, CompetitionTypeResponse,
    CalendarPlanCreate, CalendarPlanResponse
)
from app.api.deps import require_role

router = APIRouter(prefix="/competitions", tags=["Календарь соревнований"])


# ---------------- METADATA: TYPES & CALENDAR PLANS ---------------- #

@router.get("/meta/types", response_model=list[CompetitionTypeResponse])
async def list_competition_types(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CompetitionType).order_by(CompetitionType.name))
    return res.scalars().all()


@router.post("/meta/types", response_model=CompetitionTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_competition_type(
    data: CompetitionTypeCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    ctype = CompetitionType(name=data.name, description=data.description)
    db.add(ctype)
    await db.commit()
    await db.refresh(ctype)
    return ctype


@router.get("/meta/plans", response_model=list[CalendarPlanResponse])
async def list_calendar_plans(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(CalendarPlan).order_by(CalendarPlan.year.desc(), CalendarPlan.name))
    return res.scalars().all()


@router.post("/meta/plans", response_model=CalendarPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_plan(
    data: CalendarPlanCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    plan = CalendarPlan(name=data.name, year=data.year)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


# ---------------- COMPETITIONS CRUD ---------------- #

@router.get("", response_model=list[CompetitionResponse])
async def list_competitions(
    discipline_id: int | None = Query(None, description="Фильтр по ID дисциплины"),
    level: CompetitionLevel | None = Query(None, description="Уровень соревнования"),
    comp_format: CompetitionFormat | None = Query(None, description="Формат: onsite, online, mixed"),
    status: CompetitionStatus | None = Query(None, description="Статус соревнования"),
    age_group: str | None = Query(None, description="Возрастная группа"),
    athlete_age: int | None = Query(None, description="Возраст спортсмена для проверки доступности"),
    from_date: date | None = Query(None, description="Дата начала с"),
    to_date: date | None = Query(None, description="Дата начала по"),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Competition)
        .options(
            selectinload(Competition.discipline),
            selectinload(Competition.competition_type),
            selectinload(Competition.calendar_plan),
            selectinload(Competition.applications),
            selectinload(Competition.results),
        )
    )

    if discipline_id:
        query = query.where(Competition.discipline_id == discipline_id)
    if level:
        query = query.where(Competition.level == level)
    if comp_format:
        query = query.where(Competition.format == comp_format)
    if status:
        query = query.where(Competition.status == status)
    if age_group:
        query = query.where(Competition.age_group.ilike(f"%{age_group}%"))
    if athlete_age is not None:
        # Check min/max age filters
        query = query.where(
            (Competition.min_age == None) | (Competition.min_age <= athlete_age)
        ).where(
            (Competition.max_age == None) | (Competition.max_age >= athlete_age)
        )
    if from_date:
        query = query.where(Competition.start_date >= from_date)
    if to_date:
        query = query.where(Competition.start_date <= to_date)

    query = query.order_by(Competition.start_date.desc())
    res = await db.execute(query)
    comps = res.scalars().all()

    response = []
    for c in comps:
        response.append(
            CompetitionResponse(
                id=c.id,
                title=c.title,
                description=c.description,
                discipline_id=c.discipline_id,
                discipline_name=c.discipline.name if c.discipline else None,
                discipline_code=c.discipline.code if c.discipline else None,
                start_date=c.start_date,
                end_date=c.end_date,
                location=c.location,
                format=c.format,
                level=c.level,
                type_id=c.type_id,
                type_name=c.competition_type.name if c.competition_type else None,
                age_group=c.age_group,
                min_age=c.min_age,
                max_age=c.max_age,
                status=c.status,
                calendar_plan_id=c.calendar_plan_id,
                calendar_plan_name=c.calendar_plan.name if c.calendar_plan else None,
                calendar_plan_number=c.calendar_plan_number,
                regulation_file_path=c.regulation_file_path,
                registration_deadline=c.registration_deadline,
                applications_count=len(c.applications),
                results_count=len(c.results),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )
    return response


@router.get("/{comp_id}", response_model=CompetitionResponse)
async def get_competition(comp_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(Competition)
        .options(
            selectinload(Competition.discipline),
            selectinload(Competition.competition_type),
            selectinload(Competition.calendar_plan),
            selectinload(Competition.applications),
            selectinload(Competition.results),
        )
        .where(Competition.id == comp_id)
    )
    res = await db.execute(query)
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    return CompetitionResponse(
        id=c.id,
        title=c.title,
        description=c.description,
        discipline_id=c.discipline_id,
        discipline_name=c.discipline.name if c.discipline else None,
        discipline_code=c.discipline.code if c.discipline else None,
        start_date=c.start_date,
        end_date=c.end_date,
        location=c.location,
        format=c.format,
        level=c.level,
        type_id=c.type_id,
        type_name=c.competition_type.name if c.competition_type else None,
        age_group=c.age_group,
        min_age=c.min_age,
        max_age=c.max_age,
        status=c.status,
        calendar_plan_id=c.calendar_plan_id,
        calendar_plan_name=c.calendar_plan.name if c.calendar_plan else None,
        calendar_plan_number=c.calendar_plan_number,
        regulation_file_path=c.regulation_file_path,
        registration_deadline=c.registration_deadline,
        applications_count=len(c.applications),
        results_count=len(c.results),
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.post("", response_model=CompetitionResponse, status_code=status.HTTP_201_CREATED)
async def create_competition(
    data: CompetitionCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    # Verify discipline
    disc = await db.get(Discipline, data.discipline_id)
    if not disc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Указанная дисциплина не найдена")

    comp = Competition(
        title=data.title,
        description=data.description,
        discipline_id=data.discipline_id,
        start_date=data.start_date,
        end_date=data.end_date,
        location=data.location,
        format=data.format,
        level=data.level,
        type_id=data.type_id,
        age_group=data.age_group,
        min_age=data.min_age,
        max_age=data.max_age,
        status=data.status,
        calendar_plan_id=data.calendar_plan_id,
        calendar_plan_number=data.calendar_plan_number,
        registration_deadline=data.registration_deadline,
        regulation_file_path=data.regulation_file_path,
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)

    return await get_competition(comp.id, db)


@router.put("/{comp_id}", response_model=CompetitionResponse)
async def update_competition(
    comp_id: uuid.UUID,
    data: CompetitionUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    comp = await db.get(Competition, comp_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(comp, field, val)

    await db.commit()
    await db.refresh(comp)

    return await get_competition(comp.id, db)
