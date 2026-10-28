import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey, Text, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class JudgeCategoryType(str, enum.Enum):
    THIRD = "third"                     # 3 категория
    SECOND = "second"                   # 2 категория
    FIRST = "first"                     # 1 категория
    ALL_RUSSIAN = "all_russian"         # Всероссийская
    INTERNATIONAL = "international"     # Международная


class JudgeCategoryAppStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class JudgeAssignment(Base):
    __tablename__ = "judge_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    judge_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    competition_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("competitions.id"), nullable=False)
    position: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g., Главный судья, Главный секретарь
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    judge: Mapped["User"] = relationship("User", lazy="selectin")
    competition: Mapped["Competition"] = relationship("Competition", back_populates="judge_assignments")


class JudgeCategoryRecord(Base):
    __tablename__ = "judge_category_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    judge_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(SAEnum(JudgeCategoryType, native_enum=False), nullable=False)
    assigned_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    order_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    judge: Mapped["User"] = relationship("User", back_populates="judge_records")


class JudgeCategoryApplication(Base):
    __tablename__ = "judge_category_applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    judge_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    requested_category: Mapped[str] = mapped_column(SAEnum(JudgeCategoryType, native_enum=False), nullable=False)
    application_type: Mapped[str] = mapped_column(String(50), default="assignment")  # assignment, confirmation
    status: Mapped[str] = mapped_column(SAEnum(JudgeCategoryAppStatus, native_enum=False), default=JudgeCategoryAppStatus.SUBMITTED)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)

    judge: Mapped["User"] = relationship("User", foreign_keys=[judge_id], lazy="selectin")
