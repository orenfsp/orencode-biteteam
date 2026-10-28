import secrets
import uuid
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from aiogram import Bot

from app.models.verification import VerificationCode
from app.models.notification import TelegramLink
from app.models.user import User
from app.services.email_service import EmailService
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VerificationService:
    """Handles generation, dual-channel delivery (Email + Telegram), and verification of 6-digit codes."""

    @classmethod
    async def create_and_send_code(
        cls,
        db: AsyncSession,
        email: str,
        purpose: str = "login",
        user_id: uuid.UUID | None = None,
        expires_minutes: int = 10
    ) -> tuple[str, list[str]]:
        """Generates a 6-digit verification code and delivers it via Email and Telegram (if connected).

        Returns:
            (code, channels_used): e.g. ("581294", ["email", "telegram"])
        """
        clean_email = email.strip().lower()

        # If user_id is not given, find user by email
        if not user_id:
            u_res = await db.execute(select(User).where(User.email == clean_email))
            user = u_res.scalar_one_or_none()
            if user:
                user_id = user.id

        # Invalidate previous unused codes for this email and purpose
        prev_codes = await db.execute(
            select(VerificationCode).where(
                VerificationCode.email == clean_email,
                VerificationCode.purpose == purpose,
                VerificationCode.is_used == False
            )
        )
        for prev in prev_codes.scalars().all():
            prev.is_used = True

        # Generate 6-digit secure code
        code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = datetime.utcnow() + timedelta(minutes=expires_minutes)

        v_record = VerificationCode(
            email=clean_email,
            user_id=user_id,
            code=code,
            purpose=purpose,
            is_used=False,
            expires_at=expires_at,
            created_at=datetime.utcnow()
        )
        db.add(v_record)
        await db.commit()
        await db.refresh(v_record)

        channels_used = []

        # 1. Send via Email
        await EmailService.send_verification_code_email(
            to_email=clean_email,
            code=code,
            purpose=purpose,
            expires_minutes=expires_minutes
        )
        channels_used.append("email")

        # 2. If user has connected Telegram, send code to Telegram as well!
        if user_id and settings.TELEGRAM_BOT_TOKEN:
            tg_q = select(TelegramLink).where(
                TelegramLink.user_id == user_id,
                TelegramLink.is_linked == True,
                TelegramLink.telegram_chat_id.is_not(None)
            )
            tg_res = await db.execute(tg_q)
            tg_link = tg_res.scalar_one_or_none()

            if tg_link and tg_link.telegram_chat_id:
                try:
                    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
                    purpose_text = {
                        "login": "входа в систему",
                        "registration": "регистрации",
                        "reset_password": "сброса пароля"
                    }.get(purpose, purpose)

                    msg_text = (
                        f"🔐 *Код подтверждения ФСП:* `{code}`\n\n"
                        f"Используйте его для {purpose_text}.\n"
                        f"⏱ Код действует {expires_minutes} минут.\n"
                        f"Никому не передавайте этот код."
                    )
                    await bot.send_message(
                        chat_id=int(tg_link.telegram_chat_id),
                        text=msg_text,
                        parse_mode="Markdown"
                    )
                    await bot.session.close()
                    channels_used.append("telegram")
                    logger.info(f"📱 Код верификации успешно доставлен в Telegram ({tg_link.telegram_chat_id})")
                except Exception as e:
                    logger.warning(f"Не удалось отправить код в Telegram: {e}")

        logger.info(f"🔑 Создан код верификации для {clean_email} ({purpose}): {code} (каналы: {channels_used})")
        return code, channels_used

    @classmethod
    async def verify_code(
        cls,
        db: AsyncSession,
        email: str,
        code: str,
        purpose: str = "login"
    ) -> bool:
        """Verifies and consumes the 6-digit code."""
        clean_email = email.strip().lower()
        clean_code = code.strip()

        now = datetime.utcnow()
        q = select(VerificationCode).where(
            VerificationCode.email == clean_email,
            VerificationCode.code == clean_code,
            VerificationCode.purpose == purpose,
            VerificationCode.is_used == False,
            VerificationCode.expires_at > now
        ).order_by(VerificationCode.created_at.desc())

        res = await db.execute(q)
        record = res.scalar_one_or_none()

        if not record:
            return False

        # Mark code as consumed
        record.is_used = True
        await db.commit()
        return True

    @classmethod
    async def get_latest_pending_code_for_user(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID
    ) -> VerificationCode | None:
        """Used by Telegram bot to show active pending verification code."""
        now = datetime.utcnow()
        q = select(VerificationCode).where(
            VerificationCode.user_id == user_id,
            VerificationCode.is_used == False,
            VerificationCode.expires_at > now
        ).order_by(VerificationCode.created_at.desc())

        res = await db.execute(q)
        return res.scalar_one_or_none()
