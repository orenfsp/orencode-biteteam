import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Certificate(Base):
    """Certificate of participation with QR code (Bonus D10)."""
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    competition_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("competitions.id"), nullable=False)
    result_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("results.id"), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    qr_code_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    athlete: Mapped["User"] = relationship("User", lazy="selectin")
    competition: Mapped["Competition"] = relationship("Competition", lazy="selectin")
    result: Mapped["Result"] = relationship("Result", lazy="selectin")
