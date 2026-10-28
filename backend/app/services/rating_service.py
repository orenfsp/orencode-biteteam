import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.competition import Competition, CompetitionLevel
from app.models.result import Result, ResultStatus
from app.models.user import User
from app.models.rating import RatingSetting
from app.schemas.rating import RatingAthleteItem, RatingEventBreakdown, RatingResponse

DEFAULT_SCORING = {
    CompetitionLevel.CHAMPIONSHIP_RUSSIA.value: {1: 100, 2: 80, 3: 60, 4: 40, 5: 30, 6: 20},
    CompetitionLevel.FIRST_RUSSIA.value: {1: 80, 2: 60, 3: 40, 4: 25, 5: 15, 6: 10},
    CompetitionLevel.INTERREGIONAL.value: {1: 60, 2: 45, 3: 30, 4: 20, 5: 10, 6: 5},
    CompetitionLevel.REGIONAL.value: {1: 40, 2: 30, 3: 20, 4: 15, 5: 10, 6: 5},
}


class RatingService:
    @staticmethod
    async def get_scoring_table(db: AsyncSession) -> dict:
        """Fetch configurable scoring points from DB, falling back to defaults."""
        query = select(RatingSetting)
        result = await db.execute(query)
        settings = result.scalars().all()
        table = dict(DEFAULT_SCORING)
        for s in settings:
            level_key = s.level.value if hasattr(s.level, "value") else str(s.level)
            table[level_key] = {
                1: s.place_1_points,
                2: s.place_2_points,
                3: s.place_3_points,
            }
        return table

    @classmethod
    async def calculate_discipline_rating(
        cls,
        db: AsyncSession,
        discipline_id: int,
        season: str = "2025-2026",
        age_group: str | None = None
    ) -> list[RatingAthleteItem]:
        scoring = await cls.get_scoring_table(db)

        # Parse season years (e.g., "2025-2026", "2026", or "all")
        if season == "all":
            start_date = date(2020, 1, 1)
            end_date = date(2030, 12, 31)
        elif "-" in season:
            start_year, end_year = map(int, season.split("-"))
            start_date = date(start_year, 1, 1)
            end_date = date(end_year, 12, 31)
        else:
            try:
                year = int(season)
                # Sports season "2026" covers 2025-2026
                start_date = date(year - 1, 1, 1)
                end_date = date(year, 12, 31)
            except Exception:
                start_date = date(2025, 1, 1)
                end_date = date(2026, 12, 31)


        # Get all completed competitions for this discipline in the date range
        comp_query = (
            select(Competition)
            .where(
                Competition.discipline_id == discipline_id,
                Competition.start_date >= start_date,
                Competition.start_date <= end_date,
            )
        )
        if age_group:
            comp_query = comp_query.where(Competition.age_group == age_group)

        comp_result = await db.execute(comp_query)
        competitions = {c.id: c for c in comp_result.scalars().all()}

        if not competitions:
            return []

        # Get all results for these competitions
        comp_ids = list(competitions.keys())
        results_query = (
            select(Result)
            .options(
                selectinload(Result.athlete).selectinload(User.organization),
                selectinload(Result.athlete).selectinload(User.rank_records)
            )
            .where(
                Result.competition_id.in_(comp_ids),
                Result.status == ResultStatus.NORMAL
            )
        )
        res = await db.execute(results_query)
        results = res.scalars().all()

        today = date.today()

        # Group by athlete
        athlete_data: dict[uuid.UUID, dict] = {}
        for r in results:
            athlete = r.athlete
            if not athlete:
                continue

            # Check Disqualification filter:
            # Athletes with is_disqualified or active disqualification_until are excluded from rating
            if athlete.is_disqualified:
                continue
            if athlete.disqualification_until and athlete.disqualification_until >= today:
                continue

            comp = competitions[r.competition_id]
            level_str = comp.level.value if hasattr(comp.level, "value") else str(comp.level)
            level_scores = scoring.get(level_str, {1: 40, 2: 30, 3: 20})
            points = level_scores.get(r.place, 0) if r.place else 0

            if athlete.id not in athlete_data:
                # Find current rank if any
                active_ranks = [rk.rank.value if hasattr(rk.rank, "value") else str(rk.rank)
                                for rk in athlete.rank_records if rk.status == "active"]
                current_rank = active_ranks[0] if active_ranks else None

                athlete_data[athlete.id] = {
                    "athlete": athlete,
                    "rank": current_rank,
                    "raw_points": 0,
                    "starts_count": 0,
                    "top3_count": 0,
                    "events": []
                }

            athlete_data[athlete.id]["starts_count"] += 1
            if r.place and 1 <= r.place <= 3:
                athlete_data[athlete.id]["top3_count"] += 1

            athlete_data[athlete.id]["raw_points"] += points
            athlete_data[athlete.id]["events"].append(
                RatingEventBreakdown(
                    competition_id=comp.id,
                    competition_title=comp.title,
                    competition_level=level_str,
                    place=r.place,
                    points_earned=points,
                )
            )

        # Build list and apply stability multiplier (x1.2 for top3_count >= 2)
        rating_list: list[RatingAthleteItem] = []
        for aid, data in athlete_data.items():
            athlete = data["athlete"]
            raw_pts = data["raw_points"]
            top3 = data["top3_count"]
            apply_multiplier = (top3 >= 2)
            final_pts = round(raw_pts * 1.2) if apply_multiplier else raw_pts

            org_name = athlete.organization.name if athlete.organization else None

            rating_list.append(
                RatingAthleteItem(
                    athlete_id=athlete.id,
                    athlete_name=athlete.full_name,
                    organization_name=org_name,
                    municipality=athlete.municipality,
                    age_group=athlete.sport_preparation_stage or age_group,
                    rank=data["rank"],
                    raw_points=raw_pts,
                    multiplier_applied=apply_multiplier,
                    final_points=final_pts,
                    starts_count=data["starts_count"],
                    top3_count=top3,
                    events=data["events"]
                )
            )

        # Rank descending by final points, then by top3_count
        rating_list.sort(key=lambda x: (x.final_points, x.top3_count, x.raw_points), reverse=True)
        return rating_list


async def calculate_season_rating(
    discipline_id: int,
    season: str,
    db: AsyncSession,
    age_group: str | None = None,
    **kwargs
) -> list[RatingAthleteItem]:
    return await RatingService.calculate_discipline_rating(
        db=db,
        discipline_id=discipline_id,
        season=season,
        age_group=age_group
    )

