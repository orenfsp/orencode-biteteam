import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class NewsCreate(BaseModel):
    title: str
    content: str
    tag: str = "Новости федерации"
    image_url: Optional[str] = None
    target_role: Optional[str] = None  # all, athlete, coach, judge
    send_email: bool = True
    send_telegram: bool = True


class NewsResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    tag: str
    image_url: Optional[str] = None
    target_role: Optional[str] = None
    author_id: Optional[uuid.UUID] = None
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}
