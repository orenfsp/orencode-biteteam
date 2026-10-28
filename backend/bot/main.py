import asyncio
import logging
import sys
from datetime import datetime, date
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandStart, CommandObject
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory
from app.models.notification import TelegramLink
from app.models.user import User
from app.models.competition import Competition, CompetitionStatus
from app.models.rank import RankRecord

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

settings = get_settings()
dp = Dispatcher()


@dp.message(CommandStart(deep_link=True))
@dp.message(Command("start"))
async def cmd_start(message: types.Message, command: CommandObject | None = None):
    args = command.args if command else None

    if args:
        # User entered with deep link /start <code>
        success = await process_link_code(message.from_user.id, str(message.chat.id), args.strip().upper())
        if success:
            await message.answer(
                "✅ *Аккаунт успешно привязан!*\n\n"
                "Теперь вы будете получать уведомления об изменении статуса ваших заявок, "
                "публикации официальных протоколов, дедлайнах соревнований и сроках действия разрядов.",
                parse_mode="Markdown"
            )
            return
        else:
            await message.answer(
                "❌ Недействительный или устаревший код привязки. "
                "Пожалуйста, получите новый код в личном кабинете платформы.",
                parse_mode="Markdown"
            )
            return

    await message.answer(
        "👋 *Добро пожаловать в Telegram-бот Федерации спортивного программирования Оренбургской области!*\n\n"
        "Чтобы привязать ваш аккаунт платформы и получать уведомления:\n"
        "1. Перейдите в личный кабинет на платформе ФСП\n"
        "2. В разделе «Уведомления» нажмите «Подключить Telegram»\n"
        "3. Отправьте полученный код командой:\n"
        "`/link <ВАШ_КОД>`\n\n"
        "📋 Доступные команды:\n"
        "• /status — Информация о привязке и ваших данных\n"
        "• /competitions — Ближайшие соревнования\n"
        "• /help — Справка",
        parse_mode="Markdown"
    )


@dp.message(Command("link"))
async def cmd_link(message: types.Message, command: CommandObject):
    if not command.args:
        await message.answer("⚠️ Пожалуйста, укажите код привязки: `/link <КОД>`", parse_mode="Markdown")
        return

    code = command.args.strip().upper()
    success = await process_link_code(message.from_user.id, str(message.chat.id), code)
    if success:
        await message.answer(
            "✅ *Аккаунт успешно привязан!*\n\n"
            "Вы будете получать уведомления в режиме реального времени.",
            parse_mode="Markdown"
        )
    else:
        await message.answer(
            "❌ Неверный код привязки. Проверьте код в личном кабинете на платформе.",
            parse_mode="Markdown"
        )


async def process_link_code(tg_user_id: int, chat_id: str, code: str) -> bool:
    async with async_session_factory() as db:
        res = await db.execute(
            select(TelegramLink).where(TelegramLink.link_code == code)
        )
        link = res.scalar_one_or_none()
        if not link:
            return False

        link.telegram_chat_id = chat_id
        link.is_linked = True
        link.linked_at = datetime.utcnow()
        link.link_code = None  # Consume single-use code
        await db.commit()
        return True


@dp.message(Command("status"))
async def cmd_status(message: types.Message):
    chat_id = str(message.chat.id)
    async with async_session_factory() as db:
        res = await db.execute(
            select(TelegramLink).where(
                TelegramLink.telegram_chat_id == chat_id,
                TelegramLink.is_linked == True
            )
        )
        link = res.scalar_one_or_none()
        if not link:
            await message.answer(
                "ℹ️ Ваш Telegram-аккаунт пока не привязан к профилю на платформе. Используйте команду `/link <КОД>`.",
                parse_mode="Markdown"
            )
            return

        user_res = await db.execute(
            select(User)
            .options(selectinload(User.roles), selectinload(User.organization))
            .where(User.id == link.user_id)
        )
        user = user_res.scalar_one_or_none()
        if not user:
            await message.answer("Пользователь не найден.")
            return

        roles = [r.role.value if hasattr(r.role, "value") else str(r.role) for r in user.roles]

        # Check active rank
        ranks_res = await db.execute(
            select(RankRecord).where(
                RankRecord.athlete_id == user.id,
                RankRecord.status == "active"
            )
        )
        ranks = ranks_res.scalars().all()
        current_rank = ranks[-1].rank.value if ranks else "Без разряда"
        valid_until_str = ranks[-1].valid_until.strftime("%d.%m.%Y") if (ranks and ranks[-1].valid_until) else "Бессрочно"

        await message.answer(
            f"👤 *Профиль на платформе ФСП:*\n"
            f"• *ФИО:* {user.full_name}\n"
            f"• *Email:* {user.email}\n"
            f"• *Роли:* {', '.join(roles)}\n"
            f"• *Организация:* {user.organization.name if user.organization else 'Лично'}\n"
            f"• *Разряд:* {current_rank} (до: {valid_until_str})\n"
            f"• *Статус привязки:* ✅ Активен с {link.linked_at.strftime('%d.%m.%Y') if link.linked_at else '-'}",
            parse_mode="Markdown"
        )


@dp.message(Command("competitions"))
async def cmd_competitions(message: types.Message):
    async with async_session_factory() as db:
        res = await db.execute(
            select(Competition)
            .options(selectinload(Competition.discipline))
            .where(Competition.status.in_([CompetitionStatus.REGISTRATION_OPEN, CompetitionStatus.DRAFT]))
            .order_by(Competition.start_date.asc())
            .limit(5)
        )
        comps = res.scalars().all()
        if not comps:
            await message.answer("В настоящее время нет открытых соревнований.")
            return

        text = "🏆 *Ближайшие соревнования ФСП:*\n\n"
        for c in comps:
            text += (
                f"• *{c.title}*\n"
                f"  Дисциплина: {c.discipline.name if c.discipline else '-'}\n"
                f"  Даты: {c.start_date.strftime('%d.%m.%Y')} — {c.end_date.strftime('%d.%m.%Y')}\n"
                f"  Формат: {c.format.value if hasattr(c.format, 'value') else c.format}\n\n"
            )
        await message.answer(text, parse_mode="Markdown")


@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "ℹ️ *Справка по боту ФСП Оренбургской области:*\n\n"
        "• `/start` — Запуск и приветствие\n"
        "• `/link <КОД>` — Привязать Telegram к вашему аккаунту\n"
        "• `/status` — Ваши данные, разряд и статус привязки\n"
        "• `/competitions` — Список открытых соревнований\n\n"
        "При возникновении вопросов обращайтесь в Федерацию спортивного программирования Оренбургской области.",
        parse_mode="Markdown"
    )


async def start_bot():
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN не задан. Бот не запущен.")
        return

    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))
    logger.info("Запуск Telegram-бота ФСП Оренбургской области...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(start_bot())
