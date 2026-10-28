import uuid
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import get_settings
from app.models.notification import Notification, TelegramLink
from app.models.user import User
from app.schemas.notification import (
    NotificationResponse, TelegramLinkResponse, TelegramLinkRequest
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Уведомления и Telegram"])
settings = get_settings()


@router.get("", response_model=list[NotificationResponse])
async def list_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )
    res = await db.execute(query)
    return res.scalars().all()


@router.patch("/{notif_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notif_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    notif = await db.get(Notification, notif_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")

    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/telegram/link-code", response_model=TelegramLinkResponse)
async def get_or_create_telegram_link_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate or retrieve unique Telegram link code for account connection."""
    q = select(TelegramLink).where(TelegramLink.user_id == current_user.id)
    res = await db.execute(q)
    link = res.scalar_one_or_none()

    if not link:
        code = secrets.token_hex(4).upper()
        link = TelegramLink(
            user_id=current_user.id,
            link_code=code,
            is_linked=False,
            created_at=datetime.utcnow()
        )
        db.add(link)
        await db.commit()
        await db.refresh(link)
    else:
        if not link.link_code:
            link.link_code = secrets.token_hex(4).upper()
            await db.commit()
            await db.refresh(link)

    deep_link = f"https://t.me/OrenFspBot?start={link.link_code}"

    return TelegramLinkResponse(
        link_code=link.link_code,
        bot_username="OrenFspBot",
        deep_link=deep_link,
        is_linked=link.is_linked,
        telegram_chat_id=link.telegram_chat_id
    )


@router.post("/telegram/link", response_model=dict)
async def link_telegram_account(
    data: TelegramLinkRequest,
    db: AsyncSession = Depends(get_db)
):
    """Internal or bot endpoint to pair chat_id with user using link_code."""
    clean_code = data.link_code.strip().upper()
    q = select(TelegramLink).where(TelegramLink.link_code == clean_code)
    res = await db.execute(q)
    link = res.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Код привязки не найден или устарел")

    link.telegram_chat_id = data.telegram_chat_id
    link.is_linked = True
    link.linked_at = datetime.utcnow()
    await db.commit()

    return {"status": "success", "message": "Telegram-аккаунт успешно привязан"}
