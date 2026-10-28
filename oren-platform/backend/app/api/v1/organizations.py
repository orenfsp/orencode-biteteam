import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User, RoleEnum
from app.schemas.organization import OrganizationResponse, OrganizationCreate, OrganizationUpdate
from app.api.deps import require_role

router = APIRouter(prefix="/organizations", tags=["Организации и клубы"])


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    org_type: str | None = Query(None, description="Тип организации (school, university, sport_school, club, other)"),
    municipality: str | None = Query(None, description="Муниципалитет (город / район)"),
    search: str | None = Query(None, description="Поиск по названию"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Organization)
    if org_type:
        query = query.where(Organization.org_type == org_type)
    if municipality:
        query = query.where(Organization.municipality.ilike(f"%{municipality}%"))
    if search:
        query = query.where(Organization.name.ilike(f"%{search}%"))

    res = await db.execute(query.order_by(Organization.name))
    orgs = res.scalars().all()

    # Calculate members count for each organization
    response_items = []
    for org in orgs:
        count_q = select(func.count(User.id)).where(User.organization_id == org.id)
        count_res = await db.execute(count_q)
        cnt = count_res.scalar() or 0

        response_items.append(
            OrganizationResponse(
                id=org.id,
                name=org.name,
                org_type=org.org_type,
                municipality=org.municipality,
                address=org.address,
                contact_email=org.contact_email,
                contact_phone=org.contact_phone,
                details=org.details,
                members_count=cnt
            )
        )
    return response_items


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Организация не найдена")

    count_q = select(func.count(User.id)).where(User.organization_id == org.id)
    count_res = await db.execute(count_q)
    cnt = count_res.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        org_type=org.org_type,
        municipality=org.municipality,
        address=org.address,
        contact_email=org.contact_email,
        contact_phone=org.contact_phone,
        details=org.details,
        members_count=cnt
    )


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION, RoleEnum.COACH]))
):
    org = Organization(
        name=data.name,
        org_type=data.org_type,
        municipality=data.municipality,
        address=data.address,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        details=data.details
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        org_type=org.org_type,
        municipality=org.municipality,
        address=org.address,
        contact_email=org.contact_email,
        contact_phone=org.contact_phone,
        details=org.details,
        members_count=0
    )


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role([RoleEnum.FEDERATION]))
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Организация не найдена")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(org, field, val)

    await db.commit()
    await db.refresh(org)

    count_q = select(func.count(User.id)).where(User.organization_id == org.id)
    count_res = await db.execute(count_q)
    cnt = count_res.scalar() or 0

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        org_type=org.org_type,
        municipality=org.municipality,
        address=org.address,
        contact_email=org.contact_email,
        contact_phone=org.contact_phone,
        details=org.details,
        members_count=cnt
    )
