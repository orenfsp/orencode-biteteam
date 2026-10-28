from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.discipline import Discipline
from app.models.user import RoleEnum
from app.schemas.discipline import DisciplineResponse, DisciplineCreate
from app.api.deps import require_role

router = APIRouter(prefix="/disciplines", tags=["Дисциплины вида спорта"])


@router.get("", response_model=list[DisciplineResponse])
async def get_disciplines(db: AsyncSession = Depends(get_db)):
    """List all 6 sports programming disciplines."""
    query = select(Discipline).order_by(Discipline.id)
    res = await db.execute(query)
    return res.scalars().all()


@router.get("/{discipline_id}", response_model=DisciplineResponse)
async def get_discipline(discipline_id: int, db: AsyncSession = Depends(get_db)):
    disc = await db.get(Discipline, discipline_id)
    if not disc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дисциплина не найдена")
    return disc


@router.post("", response_model=DisciplineResponse, status_code=status.HTTP_201_CREATED)
async def create_discipline(
    data: DisciplineCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    disc = Discipline(name=data.name, code=data.code.upper(), description=data.description)
    db.add(disc)
    await db.commit()
    await db.refresh(disc)
    return disc
