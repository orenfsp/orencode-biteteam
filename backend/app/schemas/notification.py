import uuid
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TelegramLinkResponse(BaseModel):
    link_code: str
    bot_username: str | None = None
    deep_link: str
    is_linked: bool
    telegram_chat_id: str | None = None


class TelegramLinkRequest(BaseModel):
    link_code: str
    telegram_chat_id: str


# Compatibility aliases
NotificationRead = NotificationResponse
TelegramLinkCodeResponse = TelegramLinkResponse
TelegramStatusResponse = TelegramLinkResponse

