import asyncio
import logging
import sys
from datetime import datetime, date
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart, CommandObject
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory
from app.models.notification import TelegramLink
from app.models.user import User
from app.models.competition import Competition, CompetitionStatus
from app.models.rank import RankRecord
from app.models.news import News
from app.services.verification_service import VerificationService

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("fsp_telegram_bot")

settings = get_settings()
dp = Dispatcher()


def get_main_keyboard() -> ReplyKeyboardMarkup:
    """Returns main navigation keyboard with easy-to-tap buttons."""
    kb = [
        [
            KeyboardButton(text="📋 Соревнования"),
            KeyboardButton(text="📰 Новости")
        ],
        [
            KeyboardButton(text="👤 Мой профиль"),
            KeyboardButton(text="🔐 Код подтверждения")
        ],
        [
            KeyboardButton(text="ℹ️ Помощь")
        ]
    ]
    return ReplyKeyboardMarkup(keyboard=kb, resize_keyboard=True)


async def get_linked_user(chat_id: str) -> tuple[User | None, TelegramLink | None]:
    """Finds user linked to current chat_id."""
    async with async_session_factory() as db:
        res = await db.execute(
            select(TelegramLink).where(
                TelegramLink.telegram_chat_id == chat_id,
                TelegramLink.is_linked == True
            )
        )
        link = res.scalar_one_or_none()
        if not link:
            return None, None

        user_res = await db.execute(
            select(User)
            .options(
                selectinload(User.roles),
                selectinload(User.organization),
                selectinload(User.rank_records)
            )
            .where(User.id == link.user_id)
        )
        user = user_res.scalar_one_or_none()
        return user, link


async def process_link_code(tg_user_id: int, chat_id: str, code: str) -> tuple[bool, str | None]:
    async with async_session_factory() as db:
        res = await db.execute(
            select(TelegramLink).where(TelegramLink.link_code == code)
        )
        link = res.scalar_one_or_none()
        if not link:
            return False, None

        user_res = await db.execute(select(User).where(User.id == link.user_id))
        user = user_res.scalar_one_or_none()

        link.telegram_chat_id = chat_id
        link.is_linked = True
        link.linked_at = datetime.utcnow()
        link.link_code = None  # Consume single-use code
        await db.commit()

        user_name = user.full_name if user else "пользователь"
        return True, user_name


@dp.message(CommandStart(deep_link=True))
@dp.message(Command("start"))
async def cmd_start(message: types.Message, command: CommandObject | None = None):
    args = command.args if command else None

    if args:
        # Deep linking: /start <CODE>
        code = args.strip().upper()
        success, user_name = await process_link_code(message.from_user.id, str(message.chat.id), code)
        if success:
            await message.answer(
                f"✅ *Аккаунт успешно привязан!*\n\n"
                f"Добро пожаловать, *{user_name}*!\n"
                f"Теперь вам будут приходить:\n"
                f"• 🔐 Коды подтверждения и двухфакторной аутентификации\n"
                f"• 🔔 Уведомления о статусе заявок на соревнования\n"
                f"• 🏆 Приказы о присвоении разрядов и категорий\n"
                f"• ⏰ Напоминания о дедлайнах и истекающих сроках\n"
                f"• 📰 Новости Федерации спортивного программирования",
                parse_mode="Markdown",
                reply_markup=get_main_keyboard()
            )
            return
        else:
            await message.answer(
                "❌ Недействительный или устаревший код привязки. "
                "Получите актуальный код в личном кабинете на платформе ФСП.",
                parse_mode="Markdown",
                reply_markup=get_main_keyboard()
            )
            return

    # Check if already linked
    user, _ = await get_linked_user(str(message.chat.id))
    if user:
        await message.answer(
            f"👋 Здравствуйте, *{user.full_name}*!\n\n"
            f"Ваш Telegram-аккаунт привязан к профилю на платформе ФСП Оренбургской области.\n"
            f"Используйте кнопки меню ниже для управления.",
            parse_mode="Markdown",
            reply_markup=get_main_keyboard()
        )
    else:
        await message.answer(
            "👋 *Добро пожаловать в Telegram-бот Федерации спортивного программирования Оренбургской области!*\n\n"
            "Бот предназначен для:\n"
            "• Получения кодов верификации и 2FA\n"
            "• Мгновенных уведомлений по заявкам и разрядам\n"
            "• Отслеживания соревнований и новостей региона\n\n"
            "👉 *Как привязать аккаунт:*\n"
            "1. Войдите в личный кабинет на сайте платформы\n"
            "2. В профиле или настройках скопируйте код привязки\n"
            "3. Отправьте боту команду:\n"
            "`/link <ВАШ_КОД>`",
            parse_mode="Markdown",
            reply_markup=get_main_keyboard()
        )


@dp.message(Command("link"))
async def cmd_link(message: types.Message, command: CommandObject):
    if not command.args:
        await message.answer(
            "⚠️ Пожалуйста, укажите код привязки:\n`/link <КОД>`\n\n"
            "Код можно получить в личном кабинете на сайте ФСП.",
            parse_mode="Markdown"
        )
        return

    code = command.args.strip().upper()
    success, user_name = await process_link_code(message.from_user.id, str(message.chat.id), code)
    if success:
        await message.answer(
            f"✅ *Аккаунт успешно привязан!*\n\n"
            f"Пользователь: *{user_name}*.\n"
            f"Теперь вы будете мгновенно получать уведомления и коды верификации.",
            parse_mode="Markdown",
            reply_markup=get_main_keyboard()
        )
    else:
        await message.answer(
            "❌ Неверный или устаревший код привязки. Проверьте код в личном кабинете на платформе.",
            parse_mode="Markdown"
        )


@dp.message(Command("unlink"))
async def cmd_unlink(message: types.Message):
    """Disconnects Telegram from platform account."""
    chat_id = str(message.chat.id)
    async with async_session_factory() as db:
        res = await db.execute(
            select(TelegramLink).where(TelegramLink.telegram_chat_id == chat_id)
        )
        link = res.scalar_one_or_none()
        if not link or not link.is_linked:
            await message.answer("ℹ️ Ваш Telegram-аккаунт не был привязан.")
            return

        link.is_linked = False
        link.telegram_chat_id = None
        await db.commit()

        await message.answer(
            "🔌 Telegram-аккаунт успешно отключен от платформы. "
            "Чтобы подключить его снова, сгенерируйте новый код в личном кабинете.",
            reply_markup=get_main_keyboard()
        )


@dp.message(Command("code"))
@dp.message(Command("verify"))
@dp.message(F.text == "🔐 Код подтверждения")
async def cmd_verification_code(message: types.Message):
    """Generates or retrieves active 6-digit verification code."""
    chat_id = str(message.chat.id)
    user, _ = await get_linked_user(chat_id)

    if not user:
        await message.answer(
            "⚠️ Для получения кодов верификации ваш Telegram должен быть привязан к аккаунту.\n\n"
            "Используйте команду `/link <КОД>`, чтобы привязать профиль.",
            parse_mode="Markdown"
        )
        return

    async with async_session_factory() as db:
        # Check active code or generate a fresh one
        pending = await VerificationService.get_latest_pending_code_for_user(db, user.id)
        if pending:
            time_left = int((pending.expires_at - datetime.utcnow()).total_seconds() // 60)
            await message.answer(
                f"🔐 *Ваш действующий проверочный код:*\n\n"
                f"👉  `{pending.code}`  👈\n\n"
                f"• Назначение: _{pending.purpose}_\n"
                f"• Действителен еще: ~{max(time_left, 1)} мин.\n"
                f"• Привязан к email: `{user.email}`",
                parse_mode="Markdown"
            )
        else:
            # Generate a fresh verification code
            new_code, _ = await VerificationService.create_and_send_code(
                db=db,
                email=user.email,
                purpose="login",
                user_id=user.id
            )
            await message.answer(
                f"🔐 *Сгенерирован новый проверочный код:*\n\n"
                f"👉  `{new_code}`  👈\n\n"
                f"• Срок действия: 10 минут\n"
                f"• Отправлен также на email: `{user.email}`\n\n"
                f"Используйте его для входа или подтверждения действий на платформе.",
                parse_mode="Markdown"
            )


@dp.message(Command("status"))
@dp.message(F.text == "👤 Мой профиль")
async def cmd_status(message: types.Message):
    chat_id = str(message.chat.id)
    user, link = await get_linked_user(chat_id)

    if not user:
        await message.answer(
            "ℹ️ Ваш Telegram-аккаунт пока не привязан к профилю на платформе.\n\n"
            "Чтобы привязать, введите: `/link <КОД_ИЗ_ЛИЧНОГО_КАБИНЕТА>`",
            parse_mode="Markdown"
        )
        return

    role_translations = {
        "federation": "Федерация (Администратор)",
        "athlete": "Спортсмен",
        "coach": "Тренер",
        "judge": "Судья"
    }
    approved_roles = [role_translations.get(r.role.value if hasattr(r.role, "value") else str(r.role), str(r.role)) for r in user.roles if getattr(r, "status", "approved") == "approved"]
    pending_roles = [role_translations.get(r.role.value if hasattr(r.role, "value") else str(r.role), str(r.role)) for r in user.roles if getattr(r, "status", "approved") == "pending"]

    if pending_roles:
        roles_text = f"{', '.join(approved_roles) or 'Нет активных'} (⏳ На рассмотрении: {', '.join(pending_roles)})"
    else:
        roles_text = ', '.join(approved_roles) if approved_roles else "Без роли"

    # Active rank
    active_ranks = [r for r in user.rank_records if r.status == "active"]
    current_rank = active_ranks[-1].rank.value if active_ranks else "Без разряда"
    valid_until_str = active_ranks[-1].valid_until.strftime("%d.%m.%Y") if (active_ranks and active_ranks[-1].valid_until) else "Бессрочно"

    await message.answer(
        f"👤 *Профиль участника ФСП:*\n\n"
        f"• *ФИО:* {user.full_name}\n"
        f"• *Email:* {user.email}\n"
        f"• *Роли:* {roles_text}\n"
        f"• *Организация:* {user.organization.name if user.organization else 'Личное участие'}\n"
        f"• *Муниципалитет:* {user.municipality or 'Не указан'}\n"
        f"• *Спортивный разряд:* {current_rank} (действует до: {valid_until_str})\n"
        f"• *Статус привязки:* ✅ Подключен с {link.linked_at.strftime('%d.%m.%Y') if link and link.linked_at else '-'}",
        parse_mode="Markdown"
    )


@dp.message(Command("competitions"))
@dp.message(F.text == "📋 Соревнования")
async def cmd_competitions(message: types.Message):
    async with async_session_factory() as db:
        res = await db.execute(
            select(Competition)
            .options(selectinload(Competition.discipline))
            .where(Competition.status.in_([
                CompetitionStatus.REGISTRATION_OPEN,
                CompetitionStatus.DRAFT,
                CompetitionStatus.IN_PROGRESS
            ]))
            .order_by(Competition.start_date.asc())
            .limit(6)
        )
        comps = res.scalars().all()
        if not comps:
            await message.answer("В настоящее время нет запланированных соревнований.")
            return

        text = "🏆 *Календарь соревнований ФСП Оренбургской области:*\n\n"
        format_map = {"onsite": "Очное", "online": "Онлайн", "mixed": "Смешанное"}

        for c in comps:
            fmt = format_map.get(str(c.format.value if hasattr(c.format, "value") else c.format), "Очное")
            reg_status = "🟢 Приём заявок открыт" if c.status == CompetitionStatus.REGISTRATION_OPEN else "🟡 Скоро"
            text += (
                f"📌 *{c.title}*\n"
                f"  • Дисциплина: {c.discipline.name if c.discipline else '-'}\n"
                f"  • Даты: {c.start_date.strftime('%d.%m.%Y')} — {c.end_date.strftime('%d.%m.%Y')}\n"
                f"  • Формат: {fmt} | Место: {c.location or 'Оренбург'}\n"
                f"  • Статус: {reg_status}\n\n"
            )

        text += f"Подать заявку можно в личном кабинете на сайте: {settings.BASE_URL}"
        await message.answer(text, parse_mode="Markdown")


@dp.message(Command("news"))
@dp.message(F.text == "📰 Новости")
async def cmd_news(message: types.Message):
    """Displays the latest news from the federation."""
    async with async_session_factory() as db:
        res = await db.execute(
            select(News)
            .where(News.is_published == True)
            .order_by(News.created_at.desc())
            .limit(5)
        )
        news_items = res.scalars().all()

        if not news_items:
            await message.answer(
                "📰 *Новости Федерации спортивного программирования*\n\n"
                "В данный момент новых публикаций нет. Следите за обновлениями!",
                parse_mode="Markdown"
            )
            return

        text = "📰 *Последние новости ФСП Оренбургской области:*\n\n"
        for item in news_items:
            date_str = item.created_at.strftime("%d.%m.%Y")
            preview = item.content[:160] + ("..." if len(item.content) > 160 else "")
            text += (
                f"🔹 *{item.title}* ({date_str})\n"
                f"_{item.tag}_\n"
                f"{preview}\n\n"
            )

        text += f"Все новости и подробности доступны на сайте: {settings.BASE_URL}"
        await message.answer(text, parse_mode="Markdown")


@dp.message(Command("help"))
@dp.message(F.text == "ℹ️ Помощь")
async def cmd_help(message: types.Message):
    await message.answer(
        "ℹ️ *Справка по боту ФСП Оренбургской области*\n\n"
        "🤖 *Основные команды:*\n"
        "• `/start` — Запуск бота и приветствие\n"
        "• `/link <КОД>` — Привязать Telegram к вашему профилю\n"
        "• `/unlink` — Отвязать Telegram-аккаунт\n"
        "• `/code` или `/verify` — Получить код верификации (2FA)\n"
        "• `/status` — Ваши данные, роли, разряд и статус привязки\n"
        "• `/competitions` — Календарь соревнований региона\n"
        "• `/news` — Новости и объявления Федерации\n\n"
        "💡 *Уведомления:*\n"
        "После привязки бот автоматически присылает оповещения об одобрении заявок, "
        "присвоении спортивных разрядов, приближении дедлайнов и новостях.",
        parse_mode="Markdown",
        reply_markup=get_main_keyboard()
    )


async def start_bot():
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN не задан в .env. Telegram-бот не запущен.")
        return

    try:
        bot = Bot(token=settings.TELEGRAM_BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))
        logger.info("Запуск Telegram-бота ФСП Оренбургской области...")
        # Delete webhook first in case one was previously set
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        logger.exception(f"Критическая ошибка Telegram-бота: {e}")


if __name__ == "__main__":
    asyncio.run(start_bot())
