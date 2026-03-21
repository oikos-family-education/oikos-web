from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.family import FamilyCreate, FamilyResponse
from app.schemas.child import ChildCreate, ChildResponse
from app.services.family_service import FamilyService

router = APIRouter(prefix="/families", tags=["families"])

def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)

@router.post("", response_model=FamilyResponse, status_code=status.HTTP_201_CREATED)
async def create_family(
    req: FamilyCreate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    return await service.create_family(current_user.id, req)

@router.get("/me", response_model=FamilyResponse)
async def get_my_family(
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return family

@router.post("/me/children", response_model=ChildResponse, status_code=status.HTTP_201_CREATED)
async def add_child(
    req: ChildCreate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=400, detail="Must create a family first before adding children.")
    return await service.add_child(family.id, req)

@router.get("/me/children", response_model=list[ChildResponse])
async def get_children(
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    family = await service.get_family_by_account(current_user.id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return await service.get_children(family.id)
