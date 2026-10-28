import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey, Text, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class RankType(str, enum.Enum):
    THIRD_YOUTH = "third_youth"         # 3 юношеский
    SECOND_YOUTH = "second_youth"       # 2 юношеский
    FIRST_YOUTH = "first_youth"         # 1 юношеский
    THIRD = "third"                     # 3 разряд
    SECOND = "second"                   # 2 разряд
    FIRST = "first"                     # 1 разряд
    CMS = "cms"                         # КМС
    MS = "ms"                           # МС
    MSIC = "msic"                       # МСМК


class RankApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class RankRecord(Base):
    __tablename__ = "rank_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    rank: Mapped[str] = mapped_column(SAEnum(RankType, native_enum=False), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)  # None for MS / MSIC (lifelong)
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, expired, revoked
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    athlete: Mapped["User"] = relationship("User", back_populates="rank_records")


class RankApplication(Base):
    __tablename__ = "rank_applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    athlete_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    submitted_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    requested_rank: Mapped[str] = mapped_column(SAEnum(RankType, native_enum=False), nullable=False)
    competition_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("competitions.id"), nullable=False)
    result_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("results.id"), nullable=False)
    status: Mapped[str] = mapped_column(SAEnum(RankApplicationStatus, native_enum=False), default=RankApplicationStatus.SUBMITTED)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)

    # Relationships
    athlete: Mapped["User"] = relationship("User", foreign_keys=[athlete_id], lazy="selectin")
    submitter: Mapped["User"] = relationship("User", foreign_keys=[submitted_by], lazy="selectin")
    competition: Mapped["Competition"] = relationship("Competition", lazy="selectin")
    result: Mapped["Result"] = relationship("Result", lazy="selectin")
