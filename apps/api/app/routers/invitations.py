from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.family import FamilyResponse, InvitationAccept
from app.services.family_members_service import FamilyMembersService


router = APIRouter(prefix="/invitations", tags=["invitations"])


def get_members_service(db: AsyncSession = Depends(get_db)):
    return FamilyMembersService(db)


@router.post("/accept", response_model=FamilyResponse)
async def accept_invitation(
    req: InvitationAccept,
    current_user: User = Depends(get_current_user),
    service: FamilyMembersService = Depends(get_members_service),
):
    return await service.accept_invitation(current_user.id, req.token)
