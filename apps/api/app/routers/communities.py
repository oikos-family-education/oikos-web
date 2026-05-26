from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.community import (
    CommunityCardSchema,
    CommunityCreate,
    CommunityDetail,
    CommunityListPage,
    CommunityUpdate,
    FamilyDiscoverPage,
    FamilyDiscoverProfile,
    InvitationAcceptRequest,
    InvitationCreate,
    InvitationResponseSchema,
    MembersList,
    ReplyCreate,
    ReplyUpdate,
    ReportCreate,
    ReportSchema,
    TopicCreate,
    TopicDetailSchema,
    TopicListPage,
    TopicUpdate,
    TransferAdminRequest,
)
from app.services.community_service import CommunityService


router = APIRouter(tags=["communities"])


def get_service(db: AsyncSession = Depends(get_db)) -> CommunityService:
    return CommunityService(db)


# ── Discover families ──────────────────────────────────────────────────


@router.get("/families/discover", response_model=FamilyDiscoverPage)
async def discover_families(
    country: Optional[str] = Query(None, min_length=2, max_length=2),
    region: Optional[str] = None,
    faith: Optional[str] = None,
    denomination: Optional[str] = None,
    methods: Optional[str] = Query(None, description="comma-separated"),
    languages: Optional[str] = Query(None, description="comma-separated"),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    viewer = await svc.get_family_for_user(current_user.id)
    method_list = [m.strip() for m in (methods or "").split(",") if m.strip()]
    lang_list = [m.strip() for m in (languages or "").split(",") if m.strip()]
    return await svc.discover_families(
        viewer_family=viewer,
        country=country,
        region=region,
        faith=faith,
        denomination=denomination,
        methods=method_list,
        languages=lang_list,
        page=page,
    )


@router.get("/families/{slug}/profile", response_model=FamilyDiscoverProfile)
async def get_family_profile(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    viewer = await svc.get_family_for_user(current_user.id)
    return await svc.family_profile(viewer, slug)


# ── Family discoverability toggle ──────────────────────────────────────


@router.patch("/families/me/discoverable", response_model=dict)
async def set_discoverable(
    body: dict,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    val = bool(body.get("discoverable", False))
    family = await svc.set_discoverable(current_user.id, val)
    return {"discoverable": family.discoverable}


# ── Communities ────────────────────────────────────────────────────────


def _to_card(c) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "tagline": c.tagline,
        "region_scope": c.region_scope,
        "country_code": c.country_code,
        "region": c.region,
        "join_mode": c.join_mode,
        "cover_image_url": c.cover_image_url,
        "member_count": c.member_count,
        "principle_tags": c.principle_tags or {},
    }


@router.get("/communities", response_model=CommunityListPage)
async def discover_communities(
    country: Optional[str] = Query(None, min_length=2, max_length=2),
    region: Optional[str] = None,
    faith: Optional[str] = None,
    methods: Optional[str] = Query(None, description="comma-separated"),
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    method_list = [m.strip() for m in (methods or "").split(",") if m.strip()]
    result = await svc.discover_communities(
        user_id=current_user.id,
        country=country,
        region=region,
        faith=faith,
        methods=method_list,
        page=page,
    )
    return {
        "items": [_to_card(c) for c in result["items"]],
        "page": result["page"],
        "total": result["total"],
        "total_pages": result["total_pages"],
    }


@router.get("/communities/mine", response_model=list[CommunityDetail])
async def list_my_communities(
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    rows = await svc.list_my_communities(current_user.id)
    out = []
    for c, m in rows:
        d = _to_card(c)
        d.update({
            "description": c.description,
            "principles_text": c.principles_text,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
            "viewer_role": m.role,
            "viewer_status": m.status,
        })
        out.append(d)
    return out


@router.post("/communities", response_model=CommunityDetail, status_code=status.HTTP_201_CREATED)
async def create_community(
    data: CommunityCreate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    c = await svc.create_community(current_user.id, data)
    d = _to_card(c)
    d.update({
        "description": c.description,
        "principles_text": c.principles_text,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "viewer_role": "admin",
        "viewer_status": "active",
    })
    return d


@router.get("/communities/{slug}", response_model=CommunityDetail)
async def get_community(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    c, member = await svc.get_community(current_user.id, slug)
    d = _to_card(c)
    d.update({
        "description": c.description,
        "principles_text": c.principles_text,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "viewer_role": member.role if member else None,
        "viewer_status": member.status if member else None,
    })
    return d


@router.patch("/communities/{slug}", response_model=CommunityDetail)
async def update_community(
    slug: str,
    data: CommunityUpdate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    c = await svc.update_community(current_user.id, slug, data)
    member = await svc._get_membership(c.id, (await svc.get_family_for_user(current_user.id)).id)
    d = _to_card(c)
    d.update({
        "description": c.description,
        "principles_text": c.principles_text,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "viewer_role": member.role if member else None,
        "viewer_status": member.status if member else None,
    })
    return d


@router.delete("/communities/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.delete_community(current_user.id, slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Membership ─────────────────────────────────────────────────────────


@router.post("/communities/{slug}/join", status_code=status.HTTP_201_CREATED)
async def join_community(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    m = await svc.join_or_request(current_user.id, slug)
    return {"status": m.status, "role": m.role}


@router.post("/communities/{slug}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_community(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.leave(current_user.id, slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/communities/{slug}/members", response_model=MembersList)
async def list_members(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    return await svc.list_members(current_user.id, slug)


@router.post("/communities/{slug}/members/{family_id}/approve")
async def approve_member(
    slug: str,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    m = await svc.approve_member(current_user.id, slug, family_id)
    return {"status": m.status, "role": m.role}


@router.post("/communities/{slug}/members/{family_id}/deny", status_code=status.HTTP_204_NO_CONTENT)
async def deny_member(
    slug: str,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.deny_member(current_user.id, slug, family_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/communities/{slug}/members/{family_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    slug: str,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.remove_member(current_user.id, slug, family_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/communities/{slug}/members/{family_id}/promote")
async def promote_member(
    slug: str,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    m = await svc.promote(current_user.id, slug, family_id)
    return {"role": m.role}


@router.post("/communities/{slug}/members/{family_id}/demote")
async def demote_member(
    slug: str,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    m = await svc.demote(current_user.id, slug, family_id)
    return {"role": m.role}


@router.post("/communities/{slug}/transfer-admin", status_code=status.HTTP_204_NO_CONTENT)
async def transfer_admin(
    slug: str,
    body: TransferAdminRequest,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.transfer_admin(current_user.id, slug, body.to_family_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Invitations ────────────────────────────────────────────────────────


@router.post("/communities/{slug}/invitations", response_model=InvitationResponseSchema, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    slug: str,
    data: InvitationCreate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    inv, token = await svc.create_invitation(current_user.id, slug, data)
    return InvitationResponseSchema(
        id=inv.id,
        community_id=inv.community_id,
        invited_family_id=inv.invited_family_id,
        expires_at=inv.expires_at,
        created_at=inv.created_at,
        token=token,
    )


@router.get("/communities/{slug}/invitations", response_model=list[InvitationResponseSchema])
async def list_invitations(
    slug: str,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    invs = await svc.list_invitations(current_user.id, slug)
    return [
        InvitationResponseSchema(
            id=i.id,
            community_id=i.community_id,
            invited_family_id=i.invited_family_id,
            expires_at=i.expires_at,
            created_at=i.created_at,
            token=None,
        ) for i in invs
    ]


@router.delete("/communities/{slug}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    slug: str,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.revoke_invitation(current_user.id, slug, invitation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/communities/join/by-token", response_model=CommunityDetail)
async def accept_invitation(
    data: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    c = await svc.accept_invitation(current_user.id, data.token)
    family = await svc.get_family_for_user(current_user.id)
    member = await svc._get_membership(c.id, family.id)
    d = _to_card(c)
    d.update({
        "description": c.description,
        "principles_text": c.principles_text,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "viewer_role": member.role if member else None,
        "viewer_status": member.status if member else None,
    })
    return d


# ── Forum ──────────────────────────────────────────────────────────────


@router.get("/communities/{slug}/topics", response_model=TopicListPage)
async def list_topics(
    slug: str,
    page: int = Query(1, ge=1),
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    return await svc.list_topics(current_user.id, slug, page)


@router.post("/communities/{slug}/topics", status_code=status.HTTP_201_CREATED)
async def create_topic(
    slug: str,
    data: TopicCreate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    t = await svc.create_topic(current_user.id, slug, data)
    return {"id": str(t.id), "title": t.title, "created_at": t.created_at}


@router.get("/communities/{slug}/topics/{topic_id}", response_model=TopicDetailSchema)
async def get_topic(
    slug: str,
    topic_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    return await svc.get_topic(current_user.id, slug, topic_id)


@router.patch("/communities/{slug}/topics/{topic_id}")
async def update_topic(
    slug: str,
    topic_id: UUID,
    data: TopicUpdate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    t = await svc.update_topic(current_user.id, slug, topic_id, data)
    return {"id": str(t.id), "is_pinned": t.is_pinned, "is_locked": t.is_locked}


@router.delete("/communities/{slug}/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    slug: str,
    topic_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.delete_topic(current_user.id, slug, topic_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/communities/{slug}/topics/{topic_id}/replies", status_code=status.HTTP_201_CREATED)
async def create_reply(
    slug: str,
    topic_id: UUID,
    data: ReplyCreate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    r = await svc.create_reply(current_user.id, slug, topic_id, data)
    return {"id": str(r.id), "created_at": r.created_at}


@router.patch("/communities/{slug}/replies/{reply_id}")
async def update_reply(
    slug: str,
    reply_id: UUID,
    data: ReplyUpdate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    r = await svc.update_reply(current_user.id, slug, reply_id, data)
    return {"id": str(r.id), "edited_at": r.edited_at}


@router.delete("/communities/{slug}/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reply(
    slug: str,
    reply_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    await svc.delete_reply(current_user.id, slug, reply_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Reports ────────────────────────────────────────────────────────────


@router.post("/communities/{slug}/reports", response_model=ReportSchema, status_code=status.HTTP_201_CREATED)
async def create_report(
    slug: str,
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    svc: CommunityService = Depends(get_service),
):
    return await svc.report(current_user.id, slug, data)
