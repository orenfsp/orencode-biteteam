import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from aiogram import Bot

from app.models.notification import Notification, TelegramLink
from app.models.user import User
from app.services.email_service import EmailService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class NotificationService:
    @staticmethod
    async def send_notification(
        db: AsyncSession,
        user_id: uuid.UUID,
        type_: str,
        title: str,
        body: str
    ) -> Notification:
        """Create in-app notification and optionally send Telegram push."""
        notif = Notification(
            user_id=user_id,
            type=type_,
            title=title,
            body=body,
            is_read=False
        )
        db.add(notif)
        await db.commit()
        await db.refresh(notif)

        # 1. Deliver to Telegram if linked
        tg_query = select(TelegramLink).where(
            TelegramLink.user_id == user_id,
            TelegramLink.is_linked == True,
            TelegramLink.telegram_chat_id.is_not(None)
        )
        res = await db.execute(tg_query)
        tg_link = res.scalar_one_or_none()

        if tg_link and settings.TELEGRAM_BOT_TOKEN:
            try:
                bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
                text = f"🔔 *{title}*\n\n{body}"
                await bot.send_message(
                    chat_id=int(tg_link.telegram_chat_id),
                    text=text,
                    parse_mode="Markdown"
                )
                await bot.session.close()
            except Exception as e:
                logger.warning(f"Could not deliver Telegram notification to {tg_link.telegram_chat_id}: {e}")

        # 2. Deliver to Email
        try:
            user_res = await db.execute(select(User).where(User.id == user_id))
            user = user_res.scalar_one_or_none()
            if user and user.email:
                await EmailService.send_notification_email(
                    to_email=user.email,
                    title=title,
                    body=body,
                    link_url=settings.BASE_URL
                )
        except Exception as e:
            logger.warning(f"Could not deliver email notification to user {user_id}: {e}")

        return notif

    @classmethod
    async def notify_application_status(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        competition_title: str,
        status: str,
        rejection_reason: str | None = None
    ):
        if status == "approved":
            title = "Заявка на соревнование одобрена"
            body = f"Ваша заявка на участие в соревновании «{competition_title}» успешно одобрена!"
        elif status == "rejected":
            title = "Заявка на соревнование отклонена"
            reason_str = f"\nПричина: {rejection_reason}" if rejection_reason else ""
            body = f"Ваша заявка на соревнование «{competition_title}» была отклонена.{reason_str}"
        else:
            title = "Статус заявки изменен"
            body = f"Статус вашей заявки на соревнование «{competition_title}»: {status}"

        await cls.send_notification(db, user_id, type_="application_status", title=title, body=body)

    @classmethod
    async def notify_rank_status(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        rank_name: str,
        status: str,
        order_number: str | None = None
    ):
        if status == "approved":
            title = "Присвоение спортивного разряда"
            body = f"Вам успешно присвоен разряд: {rank_name}! Приказ № {order_number or 'б/н'}."
        elif status == "rejected":
            title = "Заявка на разряд отклонена"
            body = f"Ваша заявка на присвоение разряда {rank_name} была отклонена."
        else:
            title = "Статус заявки на разряд"
            body = f"Статус заявки на разряд {rank_name}: {status}"

        await cls.send_notification(db, user_id, type_="rank_status", title=title, body=body)

    @classmethod
    async def notify_role_status(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        role: str,
        status: str,
        rejection_reason: str | None = None
    ):
        role_names = {
            "athlete": "Спортсмен",
            "coach": "Тренер",
            "judge": "Спортивный судья",
            "federation": "Администратор Федерации"
        }
        r_name = role_names.get(role, role)
        if status == "approved":
            title = f"Роль «{r_name}» утверждена!"
            body = (
                f"Поздравляем! Администратор Федерации спортивного программирования Оренбургской области "
                f"утвердил вашу роль «{r_name}». Теперь вам доступен полный функционал личного кабинета."
            )
        else:
            title = f"Заявка на роль «{r_name}» отклонена"
            reason_str = f"\nПричина: {rejection_reason}" if rejection_reason else ""
            body = f"Ваша заявка на получение роли «{r_name}» была отклонена администратором.{reason_str}"

        await cls.send_notification(db, user_id, type_="role_status", title=title, body=body)


# Compatibility alias
create_notification = NotificationService.send_notification

