import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.discipline import Discipline
from app.models.rating import TeamRoster, TeamRosterMember
from app.models.user import User, RoleEnum
from app.schemas.rating import (
    RatingResponse, TeamRosterCreate, TeamRosterResponse, TeamRosterMemberItem
)
from app.services.rating_service import RatingService
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/rating", tags=["Рейтинг и сборная региона"])


@router.get("", response_model=RatingResponse)
@router.get("/athletes", response_model=RatingResponse)
async def get_athletes_rating(
    discipline_id: int = Query(..., description="ID дисциплины вида спорта"),
    season: str = Query("2025-2026", description="Спортивный сезон (напр. '2025-2026')"),
    age_group: str | None = Query(None, description="Фильтр по возрастной группе"),
    db: AsyncSession = Depends(get_db)
):
    disc = await db.get(Discipline, discipline_id)
    if not disc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дисциплина не найдена")

    athletes = await RatingService.calculate_discipline_rating(
        db=db,
        discipline_id=discipline_id,
        season=season,
        age_group=age_group
    )

    return RatingResponse(
        season=season,
        discipline_id=discipline_id,
        discipline_name=disc.name,
        athletes=athletes
    )


@router.post("/roster", response_model=TeamRosterResponse, status_code=status.HTTP_201_CREATED)
async def create_team_roster(
    data: TeamRosterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _role=Depends(require_role([RoleEnum.FEDERATION]))
):
    disc = await db.get(Discipline, data.discipline_id)
    if not disc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дисциплина не найдена")

    roster = TeamRoster(
        season=data.season,
        discipline_id=data.discipline_id,
        age_group=data.age_group,
        created_by=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(roster)
    await db.flush()

    for m in data.members:
        ath_id = uuid.UUID(str(m["athlete_id"]))
        member = TeamRosterMember(
            roster_id=roster.id,
            athlete_id=ath_id,
            rating_score=m.get("rating_score", 0),
            status=m.get("status", "main")
        )
        db.add(member)

    await db.commit()

    return await get_roster_details(roster.id, db)


@router.get("/rosters", response_model=list[TeamRosterResponse])
async def list_rosters(
    season: str | None = Query(None),
    discipline_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(TeamRoster)
        .options(
            selectinload(TeamRoster.discipline),
            selectinload(TeamRoster.members).selectinload(TeamRosterMember.athlete).selectinload(User.organization),
            selectinload(TeamRoster.members).selectinload(TeamRosterMember.athlete).selectinload(User.rank_records)
        )
    )
    if season:
        query = query.where(TeamRoster.season == season)
    if discipline_id:
        query = query.where(TeamRoster.discipline_id == discipline_id)

    query = query.order_by(TeamRoster.created_at.desc())
    res = await db.execute(query)
    rosters = res.scalars().all()

    result = []
    for r in rosters:
        members_list = []
        for m in r.members:
            ath = m.athlete
            active_ranks = [rk.rank.value if hasattr(rk.rank, "value") else str(rk.rank)
                            for rk in ath.rank_records if rk.status == "active"]
            members_list.append(
                TeamRosterMemberItem(
                    athlete_id=ath.id,
                    athlete_name=ath.full_name,
                    birth_date=ath.birth_date.strftime("%d.%m.%Y") if ath.birth_date else None,
                    organization_name=ath.organization.name if ath.organization else None,
                    municipality=ath.municipality,
                    rank=active_ranks[0] if active_ranks else None,
                    rating_score=m.rating_score,
                    status=m.status
                )
            )

        result.append(
            TeamRosterResponse(
                id=r.id,
                season=r.season,
                discipline_id=r.discipline_id,
                discipline_name=r.discipline.name if r.discipline else None,
                age_group=r.age_group,
                created_at=r.created_at,
                created_by=r.created_by,
                members=members_list
            )
        )
    return result


@router.get("/rosters/{roster_id}", response_model=TeamRosterResponse)
async def get_roster_details(roster_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    query = (
        select(TeamRoster)
        .options(
            selectinload(TeamRoster.discipline),
            selectinload(TeamRoster.members).selectinload(TeamRosterMember.athlete).selectinload(User.organization),
            selectinload(TeamRoster.members).selectinload(TeamRosterMember.athlete).selectinload(User.rank_records)
        )
        .where(TeamRoster.id == roster_id)
    )
    res = await db.execute(query)
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ростер сборной не найден")

    members_list = []
    for m in r.members:
        ath = m.athlete
        active_ranks = [rk.rank.value if hasattr(rk.rank, "value") else str(rk.rank)
                        for rk in ath.rank_records if rk.status == "active"]
        members_list.append(
            TeamRosterMemberItem(
                athlete_id=ath.id,
                athlete_name=ath.full_name,
                birth_date=ath.birth_date.strftime("%d.%m.%Y") if ath.birth_date else None,
                organization_name=ath.organization.name if ath.organization else None,
                municipality=ath.municipality,
                rank=active_ranks[0] if active_ranks else None,
                rating_score=m.rating_score,
                status=m.status
            )
        )

    return TeamRosterResponse(
        id=r.id,
        season=r.season,
        discipline_id=r.discipline_id,
        discipline_name=r.discipline.name if r.discipline else None,
        age_group=r.age_group,
        created_at=r.created_at,
        created_by=r.created_by,
        members=members_list
    )
