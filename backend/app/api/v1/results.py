import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.competition import Competition
from app.models.result import Result, ResultStatus
from app.models.judge import JudgeAssignment
from app.models.user import User, RoleEnum
from app.schemas.result import (
    ResultBatchCreate, ResultResponse, ProtocolResponse, ProtocolJudgeItem
)
from app.api.deps import require_role

router = APIRouter(prefix="", tags=["Результаты соревнований и протоколы"])


@router.post("/competitions/{comp_id}/results", response_model=list[ResultResponse])
async def enter_competition_results(
    comp_id: uuid.UUID,
    data: ResultBatchCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    comp = await db.get(Competition, comp_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    saved_results = []
    for item in data.items:
        # Check if result already exists for this athlete in this competition
        q = select(Result).where(Result.competition_id == comp_id, Result.athlete_id == item.athlete_id)
        res = await db.execute(q)
        existing = res.scalar_one_or_none()

        if existing:
            existing.place = item.place
            existing.score = item.score
            existing.status = item.status
            existing.notes = item.notes
            target = existing
        else:
            target = Result(
                competition_id=comp_id,
                athlete_id=item.athlete_id,
                place=item.place,
                score=item.score,
                status=item.status,
                notes=item.notes
            )
            db.add(target)
        saved_results.append(target)

    await db.commit()

    # Query back with loaded athlete info
    reload_q = (
        select(Result)
        .options(selectinload(Result.athlete).selectinload(User.organization), selectinload(Result.competition))
        .where(Result.competition_id == comp_id)
        .order_by(Result.place.asc().nullslast())
    )
    res_list = await db.execute(reload_q)
    results = res_list.scalars().all()

    return [
        ResultResponse(
            id=r.id,
            competition_id=r.competition_id,
            competition_title=r.competition.title if r.competition else None,
            athlete_id=r.athlete_id,
            athlete_name=r.athlete.full_name if r.athlete else None,
            athlete_organization=r.athlete.organization.name if r.athlete and r.athlete.organization else None,
            athlete_municipality=r.athlete.municipality if r.athlete else None,
            place=r.place,
            score=r.score,
            status=r.status,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        for r in results
    ]


@router.get("/competitions/{comp_id}/protocol", response_model=ProtocolResponse)
async def get_competition_protocol(comp_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    comp_q = (
        select(Competition)
        .options(
            selectinload(Competition.discipline),
            selectinload(Competition.judge_assignments).selectinload(JudgeAssignment.judge).selectinload(User.judge_records)
        )
        .where(Competition.id == comp_id)
    )
    comp_res = await db.execute(comp_q)
    comp = comp_res.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Соревнование не найдено")

    # Fetch results
    res_q = (
        select(Result)
        .options(selectinload(Result.athlete).selectinload(User.organization))
        .where(Result.competition_id == comp_id)
        .order_by(Result.place.asc().nullslast())
    )
    res_exec = await db.execute(res_q)
    results = res_exec.scalars().all()

    # Judges list
    judges_list = []
    for ja in comp.judge_assignments:
        active_cat = [rec.category.value if hasattr(rec.category, "value") else str(rec.category)
                      for rec in ja.judge.judge_records if rec.status == "active"]
        judges_list.append(
            ProtocolJudgeItem(
                judge_name=ja.judge.full_name,
                position=ja.position,
                category=active_cat[0] if active_cat else "Без категории"
            )
        )

    return ProtocolResponse(
        competition_id=comp.id,
        title=comp.title,
        discipline_name=comp.discipline.name if comp.discipline else "Спортивное программирование",
        start_date=comp.start_date.strftime("%d.%m.%Y"),
        end_date=comp.end_date.strftime("%d.%m.%Y"),
        location=comp.location,
        level=comp.level.value if hasattr(comp.level, "value") else str(comp.level),
        judges=judges_list,
        results=[
            ResultResponse(
                id=r.id,
                competition_id=r.competition_id,
                competition_title=comp.title,
                athlete_id=r.athlete_id,
                athlete_name=r.athlete.full_name if r.athlete else None,
                athlete_organization=r.athlete.organization.name if r.athlete and r.athlete.organization else None,
                athlete_municipality=r.athlete.municipality if r.athlete else None,
                place=r.place,
                score=r.score,
                status=r.status,
                notes=r.notes,
                created_at=r.created_at,
                updated_at=r.updated_at
            )
            for r in results
        ]
    )


@router.get("/results/athlete/{athlete_id}", response_model=list[ResultResponse])
async def get_athlete_history(athlete_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    q = (
        select(Result)
        .options(selectinload(Result.competition), selectinload(Result.athlete).selectinload(User.organization))
        .where(Result.athlete_id == athlete_id)
        .order_by(Result.created_at.desc())
    )
    res = await db.execute(q)
    results = res.scalars().all()

    return [
        ResultResponse(
            id=r.id,
            competition_id=r.competition_id,
            competition_title=r.competition.title if r.competition else None,
            athlete_id=r.athlete_id,
            athlete_name=r.athlete.full_name if r.athlete else None,
            athlete_organization=r.athlete.organization.name if r.athlete and r.athlete.organization else None,
            athlete_municipality=r.athlete.municipality if r.athlete else None,
            place=r.place,
            score=r.score,
            status=r.status,
            notes=r.notes,
            created_at=r.created_at,
            updated_at=r.updated_at
        )
        for r in results
    ]
