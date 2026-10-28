import logging
from datetime import datetime, date, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.database import async_session_factory
from app.models.competition import Competition, CompetitionStatus
from app.models.rank import RankRecord
from app.models.judge import JudgeCategoryRecord
from app.models.user import User, RoleEnum
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_registration_deadlines():
    """Check competitions with registration closing in next 24-72 hours."""
    logger.info("Running job: check_registration_deadlines")
    now = datetime.utcnow()
    in_3_days = now + timedelta(days=3)

    async with async_session_factory() as db:
        query = select(Competition).where(
            Competition.status == CompetitionStatus.REGISTRATION_OPEN,
            Competition.registration_deadline.is_not(None),
            Competition.registration_deadline > now,
            Competition.registration_deadline <= in_3_days
        )
        res = await db.execute(query)
        comps = res.scalars().all()

        for c in comps:
            hours_left = int((c.registration_deadline - now).total_seconds() // 3600)
            logger.info(f"Competition '{c.title}' registration closes in {hours_left} hours.")


async def check_expiring_ranks_and_categories():
    """Alert about ranks and judge categories expiring within 30 days."""
    logger.info("Running job: check_expiring_ranks_and_categories")
    today = date.today()
    in_30_days = today + timedelta(days=30)

    async with async_session_factory() as db:
        # Ranks
        rank_query = select(RankRecord).where(
            RankRecord.status == "active",
            RankRecord.valid_until.is_not(None),
            RankRecord.valid_until >= today,
            RankRecord.valid_until <= in_30_days
        )
        ranks_res = await db.execute(rank_query)
        expiring_ranks = ranks_res.scalars().all()

        for r in expiring_ranks:
            days = (r.valid_until - today).days
            await NotificationService.send_notification(
                db=db,
                user_id=r.athlete_id,
                type_="rank_expiring",
                title="Истекает срок действия спортивного разряда",
                body=f"Срок действия вашего разряда ({r.rank.value if hasattr(r.rank, 'value') else r.rank}) истекает через {days} дн. ({r.valid_until.strftime('%d.%m.%Y')}). Рекомендуем подать заявку на подтверждение или повышение разряда."
            )

        # Judge categories
        judge_query = select(JudgeCategoryRecord).where(
            JudgeCategoryRecord.status == "active",
            JudgeCategoryRecord.valid_until >= today,
            JudgeCategoryRecord.valid_until <= in_30_days
        )
        judge_res = await db.execute(judge_query)
        expiring_judges = judge_res.scalars().all()

        for j in expiring_judges:
            days = (j.valid_until - today).days
            await NotificationService.send_notification(
                db=db,
                user_id=j.judge_id,
                type_="judge_category_expiring",
                title="Истекает срок судейской категории",
                body=f"Срок действия вашей судейской категории ({j.category.value if hasattr(j.category, 'value') else j.category}) истекает через {days} дн. ({j.valid_until.strftime('%d.%m.%Y')})."
            )


async def check_governor_award_deadline():
    """Reminder about annual governor prizes for sports achievements (due Feb 1st)."""
    today = date.today()
    if today.month == 1 and today.day >= 15:
        logger.info("Governor sports award reminder active.")


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_registration_deadlines, "interval", hours=12, id="reg_deadlines")
        scheduler.add_job(check_expiring_ranks_and_categories, "interval", hours=24, id="expiring_ranks")
        scheduler.add_job(check_governor_award_deadline, "cron", month=1, day=20, id="gov_awards")
        scheduler.start()
        logger.info("APScheduler started successfully.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
