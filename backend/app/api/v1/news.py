import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from aiogram import Bot

from app.database import get_db
from app.config import get_settings
from app.models.news import News
from app.models.user import User, RoleEnum, UserRole
from app.models.notification import Notification, TelegramLink
from app.schemas.news import NewsCreate, NewsResponse
from app.services.email_service import EmailService
from app.api.deps import get_current_user, require_federation

router = APIRouter(prefix="/news", tags=["Новости и оповещения федерации"])
settings = get_settings()


@router.get("", response_model=List[NewsResponse])
async def list_news(
    tag: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Public list of federation news and announcements."""
    query = select(News).where(News.is_published == True)
    if tag:
        query = query.where(News.tag == tag)
    query = query.order_by(News.created_at.desc()).limit(limit)

    res = await db.execute(query)
    return res.scalars().all()


@router.get("/{news_id}", response_model=NewsResponse)
async def get_news_item(news_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    news = await db.get(News, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="Новость не найдена")
    return news


@router.post("", response_model=NewsResponse, status_code=status.HTTP_201_CREATED)
async def create_and_broadcast_news(
    data: NewsCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_federation)
):
    """Publishes news and broadcasts notifications to Email, Telegram, and In-App."""
    news = News(
        title=data.title,
        content=data.content,
        tag=data.tag,
        image_url=data.image_url,
        target_role=data.target_role,
        author_id=admin.id,
        is_published=True
    )
    db.add(news)
    await db.commit()
    await db.refresh(news)

    # 1. Determine target users
    users_query = select(User)
    if data.target_role and data.target_role != "all":
        users_query = users_query.join(User.roles).where(UserRole.role == data.target_role)

    users_res = await db.execute(users_query)
    target_users = users_res.scalars().all()

    # 2. In-App Notifications
    for u in target_users:
        notif = Notification(
            user_id=u.id,
            type="news_broadcast",
            title=f"📰 {data.title}",
            body=data.content[:300] + ("..." if len(data.content) > 300 else ""),
            is_read=False
        )
        db.add(notif)
    await db.commit()

    # 3. Email Broadcast
    if data.send_email and target_users:
        user_emails = [u.email for u in target_users if u.email and "@" in u.email]
        await EmailService.send_news_email(
            to_emails=user_emails,
            title=data.title,
            content=data.content,
            tag=data.tag,
            news_url=f"{settings.BASE_URL}/#/news/{news.id}"
        )

    # 4. Telegram Broadcast
    if data.send_telegram and settings.TELEGRAM_BOT_TOKEN:
        user_ids = [u.id for u in target_users]
        tg_query = select(TelegramLink).where(
            TelegramLink.user_id.in_(user_ids),
            TelegramLink.is_linked == True,
            TelegramLink.telegram_chat_id.is_not(None)
        )
        tg_res = await db.execute(tg_query)
        tg_links = tg_res.scalars().all()

        if tg_links:
            try:
                bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
                tg_text = (
                    f"📰 *{data.title}*\n"
                    f"_{data.tag}_\n\n"
                    f"{data.content}\n\n"
                    f"🔗 [Открыть на портале]({settings.BASE_URL})"
                )
                for link in tg_links:
                    try:
                        await bot.send_message(
                            chat_id=int(link.telegram_chat_id),
                            text=tg_text,
                            parse_mode="Markdown"
                        )
                    except Exception:
                        pass
                await bot.session.close()
            except Exception:
                pass

    return news
