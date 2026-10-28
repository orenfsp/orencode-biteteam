from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from app.models.competition import CompetitionLevel
from app.models.rank import RankType


class EvskService:
    """Rules and calculation according to Russian Unified Sports Classification (ЕВСК)

    for Computer Sports / Sports Programming.
    """

    @staticmethod
    def calculate_validity_date(rank: RankType, assigned_date: date) -> date | None:
        """Calculate validity end date according to EVSK regulations:

        - Youth ranks (3, 2, 1) and adult mass ranks (3, 2, 1): 2 years
        - Candidate Master of Sports (CMS): 3 years
        - Master of Sports (MS) / International Master (MSIC): Lifetime (None)
        """
        if rank in [RankType.MS, RankType.MSIC]:
            return None
        elif rank == RankType.CMS:
            return assigned_date + relativedelta(years=3)
        else:
            return assigned_date + relativedelta(years=2)

    @staticmethod
    def check_evsk_eligibility(level: CompetitionLevel, place: int | None) -> dict:
        """Check if athlete's place in competition of given level qualifies for a rank."""
        if not place or place <= 0:
            return {"eligible": False, "recommended_rank": None, "reason": "Участник не занял призовое место"}

        if level == CompetitionLevel.CHAMPIONSHIP_RUSSIA:
            if place == 1:
                return {"eligible": True, "recommended_rank": RankType.MS.value, "reason": "1 место на Чемпионате России — норматив МС"}
            elif place in [2, 3]:
                return {"eligible": True, "recommended_rank": RankType.CMS.value, "reason": "2-3 место на Чемпионате России — норматив КМС"}
            elif place <= 6:
                return {"eligible": True, "recommended_rank": RankType.FIRST.value, "reason": "4-6 место на Чемпионате России — норматив 1 разряда"}
            elif place <= 10:
                return {"eligible": True, "recommended_rank": RankType.SECOND.value, "reason": "7-10 место на Чемпионате России — норматив 2 разряда"}

        elif level == CompetitionLevel.FIRST_RUSSIA:
            if place in [1, 2]:
                return {"eligible": True, "recommended_rank": RankType.CMS.value, "reason": "1-2 место на Первенстве России — норматив КМС"}
            elif place in [3, 4]:
                return {"eligible": True, "recommended_rank": RankType.FIRST.value, "reason": "3-4 место на Первенстве России — норматив 1 разряда"}
            elif place <= 8:
                return {"eligible": True, "recommended_rank": RankType.SECOND.value, "reason": "5-8 место на Первенстве России — норматив 2 разряда"}

        elif level == CompetitionLevel.INTERREGIONAL:
            if place == 1:
                return {"eligible": True, "recommended_rank": RankType.FIRST.value, "reason": "1 место на Межрегиональных соревнованиях (ПФО) — норматив 1 разряда"}
            elif place in [2, 3]:
                return {"eligible": True, "recommended_rank": RankType.SECOND.value, "reason": "2-3 место на Межрегиональных соревнованиях (ПФО) — норматив 2 разряда"}
            elif place <= 6:
                return {"eligible": True, "recommended_rank": RankType.THIRD.value, "reason": "4-6 место на Межрегиональных соревнованиях — норматив 3 разряда"}

        elif level == CompetitionLevel.REGIONAL:
            if place == 1:
                return {"eligible": True, "recommended_rank": RankType.FIRST.value, "reason": "1 место на Чемпионате/Кубке Оренбургской области — норматив 1 разряда"}
            elif place in [2, 3]:
                return {"eligible": True, "recommended_rank": RankType.SECOND.value, "reason": "2-3 место на Чемпионате/Первенстве области — норматив 2 разряда"}
            elif place <= 6:
                return {"eligible": True, "recommended_rank": RankType.THIRD.value, "reason": "4-6 место на региональных соревнованиях — норматив 3 разряда"}
            elif place <= 10:
                return {"eligible": True, "recommended_rank": RankType.FIRST_YOUTH.value, "reason": "7-10 место среди юниоров — норматив 1 юношеского разряда"}

        return {"eligible": False, "recommended_rank": None, "reason": "Результат не удовлетворяет нормативам ЕВСК"}


evaluate_evsk_rank = EvskService.check_evsk_eligibility


def evaluate_evsk_rank(level, place: int | None) -> str | None:
    if isinstance(level, str):
        for l in CompetitionLevel:
            if l.value == level or l.name == level:
                level = l
                break
    res = EvskService.check_evsk_eligibility(level, place)
    return res.get("recommended_rank")


def calculate_rank_validity_date(rank, assigned_date: date) -> date | None:
    if isinstance(rank, str):
        for r in RankType:
            if r.value == rank or r.name == rank:
                rank = r
                break
    return EvskService.calculate_validity_date(rank, assigned_date)

