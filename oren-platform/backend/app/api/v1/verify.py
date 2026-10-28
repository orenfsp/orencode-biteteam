from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.document import Certificate
from app.models.competition import Competition
from app.models.result import Result
from app.schemas.document import PublicVerifyResponse

router = APIRouter(prefix="/verify", tags=["Публичная верификация сертификатов (Д10)"])


@router.get("/{certificate_number}", response_model=PublicVerifyResponse)
async def verify_certificate(certificate_number: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint to verify certificate authenticity via QR code."""
    clean_num = certificate_number.strip().upper()
    query = (
        select(Certificate)
        .options(
            selectinload(Certificate.athlete),
            selectinload(Certificate.competition).selectinload(Competition.discipline),
            selectinload(Certificate.result)
        )
        .where(Certificate.number == clean_num)
    )
    res = await db.execute(query)
    cert = res.scalar_one_or_none()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Сертификат с номером '{clean_num}' не найден в реестре ФСП Оренбургской области."
        )

    comp = cert.competition
    res_obj = cert.result
    disc_name = comp.discipline.name if comp.discipline else "Спортивное программирование"
    comp_dates = f"{comp.start_date.strftime('%d.%m.%Y')} — {comp.end_date.strftime('%d.%m.%Y')}"

    return PublicVerifyResponse(
        valid=True,
        number=cert.number,
        athlete_name=cert.athlete.full_name,
        competition_title=comp.title,
        discipline_name=disc_name,
        competition_date=comp_dates,
        place=res_obj.place if res_obj else None,
        status="Подлинный (выдан РОО ФСП Оренбургской области)",
        issued_at=cert.created_at.strftime("%d.%m.%Y %H:%M UTC")
    )
