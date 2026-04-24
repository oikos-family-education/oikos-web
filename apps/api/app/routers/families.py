from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.family import (
    FamilyCreate,
    FamilyResponse,
    FamilyUpdate,
    ShieldConfig,
    MemberResponse,
    InvitationCreate,
    InvitationResponse,
    ExportResponse,
)
from app.schemas.child import ChildCreate, ChildUpdate, ChildResponse
from app.services.family_service import FamilyService
from app.services.family_members_service import FamilyMembersService

router = APIRouter(prefix="/families", tags=["families"])

def get_family_service(db: AsyncSession = Depends(get_db)):
    return FamilyService(db)

def get_members_service(db: AsyncSession = Depends(get_db)):
    return FamilyMembersService(db)


async def _require_family(user_id: UUID, service: FamilyService):
    family = await service.get_family_by_account(user_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not configured yet.")
    return family


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
    return await _require_family(current_user.id, service)


@router.patch("/me", response_model=FamilyResponse)
async def update_my_family(
    req: FamilyUpdate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    return await service.update_family(current_user.id, req)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_family(
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    await service.delete_family(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me/shield", response_model=FamilyResponse)
async def update_shield(
    req: ShieldConfig,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service)
):
    return await service.update_shield(current_user.id, req.model_dump())


# ---------- Members ----------

@router.get("/me/members", response_model=list[MemberResponse])
async def list_members(
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    return await members_service.list_members(family.id)


@router.post("/me/members/invite", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    req: InvitationCreate,
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    invitation, token = await members_service.invite(family.id, current_user.id, req.email)
    return InvitationResponse.model_validate({
        "id": invitation.id,
        "family_id": invitation.family_id,
        "email": invitation.email,
        "expires_at": invitation.expires_at,
        "invited_by_user_id": invitation.invited_by_user_id,
        "created_at": invitation.created_at,
        "token": token,
    })


@router.post("/me/members/invite/{invitation_id}/resend", response_model=InvitationResponse)
async def resend_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    invitation, token = await members_service.resend(family.id, current_user.id, invitation_id)
    return InvitationResponse.model_validate({
        "id": invitation.id,
        "family_id": invitation.family_id,
        "email": invitation.email,
        "expires_at": invitation.expires_at,
        "invited_by_user_id": invitation.invited_by_user_id,
        "created_at": invitation.created_at,
        "token": token,
    })


@router.delete("/me/members/invite/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    await members_service.revoke(family.id, current_user.id, invitation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    await members_service.remove_member(family.id, current_user.id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/members/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_family(
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
    members_service: FamilyMembersService = Depends(get_members_service),
):
    family = await _require_family(current_user.id, family_service)
    await members_service.leave(family.id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Export ----------

@router.post("/me/export", response_model=ExportResponse)
async def request_export(
    current_user: User = Depends(get_current_user),
    family_service: FamilyService = Depends(get_family_service),
):
    await _require_family(current_user.id, family_service)
    # v1 stub: acknowledge the request. Real async export is deferred.
    return ExportResponse(status="pending", url=None)


# ---------- Children ----------

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
    include_archived: bool = Query(False),
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await _require_family(current_user.id, service)
    return await service.get_children(family.id, include_archived=include_archived)


@router.get("/me/children/{child_id}", response_model=ChildResponse)
async def get_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await _require_family(current_user.id, service)
    return await service.get_child(child_id, family.id)


@router.patch("/me/children/{child_id}", response_model=ChildResponse)
async def update_child(
    child_id: UUID,
    req: ChildUpdate,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await _require_family(current_user.id, service)
    return await service.update_child(child_id, family.id, req)


@router.post("/me/children/{child_id}/archive", response_model=ChildResponse)
async def archive_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await _require_family(current_user.id, service)
    return await service.archive_child(child_id, family.id)


@router.post("/me/children/{child_id}/unarchive", response_model=ChildResponse)
async def unarchive_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FamilyService = Depends(get_family_service),
):
    family = await _require_family(current_user.id, service)
    return await service.unarchive_child(child_id, family.id)
