"""Community service — all business logic for the community area.

Spec: docs/superpowers/specs/2026-05-26-community-area-design.md
"""
from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child import Child
from app.models.community import (
    Community,
    CommunityInvitation,
    CommunityMember,
    CommunityReply,
    CommunityReport,
    CommunityTopic,
    Notification,
)
from app.models.family import Family
from app.models.family_member import FamilyMember
from app.models.user import User
from app.schemas.community import (
    CommunityCreate,
    CommunityUpdate,
    InvitationCreate,
    JoinMode,
    PrincipleTags,
    RegionScope,
    ReportCreate,
    ReplyCreate,
    ReplyUpdate,
    TopicCreate,
    TopicUpdate,
)


MAX_COMMUNITIES_PER_FAMILY = 5
EDIT_WINDOW_MINUTES = 30
INVITATION_TTL_DAYS = 14
DISCOVER_PAGE_SIZE = 24
COMMUNITY_PAGE_SIZE = 24
TOPIC_PAGE_SIZE = 25
EXCERPT_LEN = 140


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(s: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9\s-]", "", s).lower()
    base = re.sub(r"\s+", "-", base.strip())
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "community"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class CommunityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Family resolution ──────────────────────────────────────────────

    async def get_family_for_user(self, user_id: uuid.UUID) -> Family:
        result = await self.db.execute(
            select(Family).join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user_id)
        )
        family = result.scalars().first()
        if not family:
            raise HTTPException(status_code=400, detail="You must have a family before using the community area.")
        return family

    async def _family_by_slug(self, slug: str) -> Family:
        res = await self.db.execute(select(Family).where(Family.family_name_slug == slug))
        family = res.scalars().first()
        if not family:
            raise HTTPException(status_code=404, detail="Family not found.")
        return family

    async def _family_by_id(self, family_id: uuid.UUID) -> Family:
        res = await self.db.execute(select(Family).where(Family.id == family_id))
        family = res.scalars().first()
        if not family:
            raise HTTPException(status_code=404, detail="Family not found.")
        return family

    # ── Slug helpers ───────────────────────────────────────────────────

    async def _unique_community_slug(self, base: str) -> str:
        slug = _slugify(base)
        attempt = slug
        n = 0
        while True:
            res = await self.db.execute(select(Community.id).where(Community.slug == attempt))
            if not res.scalars().first():
                return attempt
            n += 1
            attempt = f"{slug}-{n}"

    # ── Children stats (for discover cards) ────────────────────────────

    async def _children_age_stats(self, family_id: uuid.UUID) -> tuple[int, Optional[int], Optional[int]]:
        """Returns (count, min_age, max_age) for non-archived children."""
        res = await self.db.execute(
            select(Child).where(Child.family_id == family_id, Child.archived_at.is_(None))
        )
        children = list(res.scalars().all())
        if not children:
            return 0, None, None

        today = datetime.now(timezone.utc).date()
        ages: list[int] = []
        for c in children:
            if c.birthdate is not None:
                a = today.year - c.birthdate.year - (
                    (today.month, today.day) < (c.birthdate.month, c.birthdate.day)
                )
                if a >= 0:
                    ages.append(a)
            elif c.birth_year is not None:
                ages.append(max(0, today.year - c.birth_year))
        if not ages:
            return len(children), None, None
        return len(children), min(ages), max(ages)

    def _excerpt(self, text: Optional[str]) -> Optional[str]:
        if not text:
            return None
        text = text.strip()
        if len(text) <= EXCERPT_LEN:
            return text
        return text[: EXCERPT_LEN - 1].rstrip() + "…"

    async def _family_to_card(self, family: Family) -> dict:
        count, age_min, age_max = await self._children_age_stats(family.id)
        return {
            "id": family.id,
            "family_name": family.family_name,
            "family_name_slug": family.family_name_slug,
            "shield_config": family.shield_config or None,
            "location_country": family.location_country,
            "location_country_code": family.location_country_code,
            "location_region": family.location_region,
            "faith_tradition": family.faith_tradition,
            "faith_denomination": family.faith_denomination,
            "education_purpose": family.education_purpose,
            "education_methods": list(family.education_methods or []),
            "home_languages": list(family.home_languages or []),
            "family_culture_excerpt": self._excerpt(family.family_culture),
            "children_count": count,
            "children_age_min": age_min,
            "children_age_max": age_max,
        }

    # ── Discover (families) ────────────────────────────────────────────

    async def discover_families(
        self,
        viewer_family: Family,
        country: Optional[str],
        region: Optional[str],
        faith: Optional[str],
        denomination: Optional[str],
        methods: list[str],
        languages: list[str],
        page: int = 1,
    ) -> dict:
        if not country:
            return {"items": [], "page": 1, "total": 0, "total_pages": 0}

        # A family is reachable from Discover if EITHER (a) they explicitly opted
        # in via the new boolean, OR (b) they have a non-private legacy
        # visibility setting (`local` / `public`). The bridge avoids hiding every
        # pre-existing family behind a separate opt-in that few will find.
        q = select(Family).where(
            or_(
                Family.discoverable.is_(True),
                Family.visibility.in_(["local", "public"]),
            ),
            Family.id != viewer_family.id,
            Family.location_country_code == country.upper(),
        )
        if region:
            q = q.where(Family.location_region == region)
        if faith:
            q = q.where(Family.faith_tradition == faith)
        if denomination:
            q = q.where(Family.faith_denomination.ilike(f"%{denomination}%"))
        if methods:
            q = q.where(Family.education_methods.overlap(methods))
        if languages:
            q = q.where(Family.home_languages.overlap(languages))

        # Count
        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        q = q.order_by(Family.created_at.desc())
        offset = max(0, (page - 1) * DISCOVER_PAGE_SIZE)
        q = q.offset(offset).limit(DISCOVER_PAGE_SIZE)
        rows = list((await self.db.execute(q)).scalars().all())
        items = [await self._family_to_card(f) for f in rows]
        total_pages = (total + DISCOVER_PAGE_SIZE - 1) // DISCOVER_PAGE_SIZE
        return {"items": items, "page": page, "total": total, "total_pages": total_pages}

    async def family_profile(self, viewer_family: Family, slug: str) -> dict:
        family = await self._family_by_slug(slug)
        # Visibility check: opt-in OR legacy non-private visibility OR shares a community.
        shares_community = await self._families_share_community(viewer_family.id, family.id)
        is_public = family.discoverable or family.visibility in ("local", "public")
        if not is_public and not shares_community:
            raise HTTPException(status_code=404, detail="Family not found.")

        card = await self._family_to_card(family)
        card.update({
            "family_culture": family.family_culture,
            "worldview_notes": family.worldview_notes,
            "current_curriculum": list(family.current_curriculum or []),
            "diet": family.diet,
            "screen_policy": family.screen_policy,
            "outdoor_orientation": family.outdoor_orientation,
            "visible_communities": await self._family_visible_communities(viewer_family.id, family.id),
        })
        return card

    async def _families_share_community(self, a: uuid.UUID, b: uuid.UUID) -> bool:
        res = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == a, CommunityMember.status == "active"
            )
        )
        a_communities = {row[0] for row in res.all()}
        if not a_communities:
            return False
        res = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == b,
                CommunityMember.status == "active",
                CommunityMember.community_id.in_(a_communities),
            )
        )
        return res.first() is not None

    async def _family_visible_communities(
        self, viewer_family_id: uuid.UUID, target_family_id: uuid.UUID
    ) -> list[dict]:
        """Communities the target is in that the viewer can also see.

        - Communities the viewer is in (both members) → always visible
        - Discoverable communities (non-deleted, country/online scope) → visible
        """
        # Viewer's communities (active membership)
        res = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == viewer_family_id,
                CommunityMember.status == "active",
            )
        )
        viewer_set = {row[0] for row in res.all()}

        # Target's active communities
        res = await self.db.execute(
            select(Community)
            .join(CommunityMember, CommunityMember.community_id == Community.id)
            .where(
                CommunityMember.family_id == target_family_id,
                CommunityMember.status == "active",
                Community.deleted_at.is_(None),
            )
        )
        out = []
        for c in res.scalars().all():
            if c.id in viewer_set:
                visible = True
            else:
                # All non-deleted communities are publicly listable in discover →
                # safe to surface here too.
                visible = True
            if visible:
                out.append({
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
                })
        return out

    # ── Community CRUD ─────────────────────────────────────────────────

    async def _get_community(self, slug: str) -> Community:
        res = await self.db.execute(
            select(Community).where(Community.slug == slug, Community.deleted_at.is_(None))
        )
        c = res.scalars().first()
        if not c:
            raise HTTPException(status_code=404, detail="Community not found.")
        return c

    async def _get_membership(
        self, community_id: uuid.UUID, family_id: uuid.UUID
    ) -> Optional[CommunityMember]:
        res = await self.db.execute(
            select(CommunityMember).where(
                CommunityMember.community_id == community_id,
                CommunityMember.family_id == family_id,
            )
        )
        return res.scalars().first()

    async def _active_member_count(self, family_id: uuid.UUID) -> int:
        res = await self.db.execute(
            select(func.count()).select_from(CommunityMember).where(
                CommunityMember.family_id == family_id,
                CommunityMember.status == "active",
            )
        )
        return int(res.scalar_one() or 0)

    async def create_community(self, user_id: uuid.UUID, data: CommunityCreate) -> Community:
        family = await self.get_family_for_user(user_id)

        active = await self._active_member_count(family.id)
        if active >= MAX_COMMUNITIES_PER_FAMILY:
            raise HTTPException(
                status_code=409,
                detail=f"You are already in {MAX_COMMUNITIES_PER_FAMILY} communities. Leave one to create another.",
            )

        # Validate region requirements
        self._validate_region(data.region_scope, data.country_code, data.region)
        self._validate_age_range(data.child_age_min, data.child_age_max)

        slug_seed = data.slug or data.name
        slug = await self._unique_community_slug(slug_seed)

        c = Community(
            slug=slug,
            name=data.name.strip(),
            tagline=data.tagline,
            description=data.description or "",
            principles_text=data.principles_text or "",
            principle_tags=data.principle_tags.model_dump() if data.principle_tags else {},
            region_scope=data.region_scope.value,
            country_code=(data.country_code or "").upper() or None,
            region=data.region,
            join_mode=data.join_mode.value,
            cover_image_url=data.cover_image_url,
            child_age_min=data.child_age_min,
            child_age_max=data.child_age_max,
            identity=data.identity.model_dump(exclude_none=True) if data.identity else None,
            member_count=1,
            created_by_family_id=family.id,
        )
        self.db.add(c)
        await self.db.flush()

        self.db.add(CommunityMember(
            community_id=c.id,
            family_id=family.id,
            role="admin",
            status="active",
            joined_at=utcnow(),
        ))
        await self.db.commit()
        await self.db.refresh(c)
        return c

    def _validate_region(
        self,
        scope: RegionScope,
        country_code: Optional[str],
        region: Optional[str],
    ) -> None:
        if scope != RegionScope.ONLINE and not country_code:
            raise HTTPException(status_code=422, detail="Country is required for non-online communities.")
        if scope == RegionScope.COUNTRY_REGION and not region:
            raise HTTPException(status_code=422, detail="Region is required when scope is country_region.")

    def _validate_age_range(self, lo: Optional[int], hi: Optional[int]) -> None:
        if lo is not None and hi is not None and lo > hi:
            raise HTTPException(
                status_code=422,
                detail="Minimum age must be less than or equal to maximum age.",
            )

    async def update_community(
        self, user_id: uuid.UUID, slug: str, data: CommunityUpdate
    ) -> Community:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        member = await self._get_membership(c.id, family.id)
        if not member or member.status != "active" or member.role not in ("admin", "co_admin"):
            raise HTTPException(status_code=403, detail="Admin only.")

        upd = data.model_dump(exclude_unset=True)

        # Only the primary admin can edit name/slug
        if ("name" in upd or "slug" in upd) and member.role != "admin":
            raise HTTPException(status_code=403, detail="Only the community admin can edit name or slug.")

        # Region validation
        new_scope = RegionScope(upd["region_scope"]) if "region_scope" in upd and upd["region_scope"] else RegionScope(c.region_scope)
        new_country = upd.get("country_code", c.country_code)
        new_region = upd.get("region", c.region)
        self._validate_region(new_scope, new_country, new_region)

        new_lo = upd["child_age_min"] if "child_age_min" in upd else c.child_age_min
        new_hi = upd["child_age_max"] if "child_age_max" in upd else c.child_age_max
        self._validate_age_range(new_lo, new_hi)

        if "slug" in upd and upd["slug"]:
            new_slug = _slugify(upd["slug"])
            if new_slug != c.slug:
                upd["slug"] = await self._unique_community_slug(new_slug)
            else:
                upd["slug"] = new_slug

        if "principle_tags" in upd and upd["principle_tags"] is not None:
            pt = upd["principle_tags"]
            if hasattr(pt, "model_dump"):
                upd["principle_tags"] = pt.model_dump()

        if "region_scope" in upd and upd["region_scope"]:
            v = upd["region_scope"]
            upd["region_scope"] = v.value if hasattr(v, "value") else v
        if "join_mode" in upd and upd["join_mode"]:
            v = upd["join_mode"]
            upd["join_mode"] = v.value if hasattr(v, "value") else v
        if "country_code" in upd and upd["country_code"]:
            upd["country_code"] = upd["country_code"].upper()

        if "identity" in upd and upd["identity"] is not None:
            iv = upd["identity"]
            if hasattr(iv, "model_dump"):
                upd["identity"] = iv.model_dump(exclude_none=True)

        for k, v in upd.items():
            setattr(c, k, v)

        await self.db.commit()
        await self.db.refresh(c)
        return c

    async def delete_community(self, user_id: uuid.UUID, slug: str) -> None:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        member = await self._get_membership(c.id, family.id)
        if not member or member.role != "admin" or member.status != "active":
            raise HTTPException(status_code=403, detail="Only the community admin can delete the community.")
        c.deleted_at = utcnow()
        await self.db.commit()

    async def get_community(self, user_id: uuid.UUID, slug: str) -> tuple[Community, Optional[CommunityMember]]:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        member = await self._get_membership(c.id, family.id)
        return c, member

    async def list_my_communities(self, user_id: uuid.UUID) -> list[tuple[Community, CommunityMember]]:
        family = await self.get_family_for_user(user_id)
        res = await self.db.execute(
            select(Community, CommunityMember)
            .join(CommunityMember, CommunityMember.community_id == Community.id)
            .where(
                CommunityMember.family_id == family.id,
                CommunityMember.status.in_(["active", "pending"]),
                Community.deleted_at.is_(None),
            )
            .order_by(Community.name.asc())
        )
        return [(c, m) for c, m in res.all()]

    async def discover_communities(
        self,
        user_id: uuid.UUID,
        country: Optional[str],
        region: Optional[str],
        faith: Optional[str],
        methods: list[str],
        age_min: Optional[int] = None,
        age_max: Optional[int] = None,
        page: int = 1,
    ) -> dict:
        family = await self.get_family_for_user(user_id)

        # Exclude communities the family is already in (any status)
        sub = (
            select(CommunityMember.community_id)
            .where(CommunityMember.family_id == family.id)
            .subquery()
        )
        q = select(Community).where(
            Community.deleted_at.is_(None),
            # Communities the admin has closed to new joiners are hidden from
            # discover; existing members still see them via /communities/mine.
            Community.closed_to_new_members.is_(False),
            ~Community.id.in_(select(sub.c.community_id)),
        )
        if country:
            q = q.where(
                or_(
                    Community.region_scope == "online",
                    Community.country_code == country.upper(),
                )
            )
        if region:
            q = q.where(
                or_(Community.region_scope == "online", Community.region == region)
            )
        # principle_tags filtering: faith and methods stored as JSON
        if faith:
            q = q.where(Community.principle_tags["faith"].astext == faith)
        # Age-range overlap: community matches when its [min, max] window
        # overlaps the requested [age_min, age_max]. NULL on either side of
        # the community range means "no bound" and always overlaps.
        if age_max is not None:
            q = q.where(
                or_(
                    Community.child_age_min.is_(None),
                    Community.child_age_min <= age_max,
                )
            )
        if age_min is not None:
            q = q.where(
                or_(
                    Community.child_age_max.is_(None),
                    Community.child_age_max >= age_min,
                )
            )
        # Methods overlap on JSON arrays — use raw JSON containment for simplicity:
        # filter in Python after the query to avoid dialect-specific JSONB ops.
        # Pagination first, then filter.

        count_q = select(func.count()).select_from(q.subquery())
        total = (await self.db.execute(count_q)).scalar_one()
        q = q.order_by(Community.member_count.desc(), Community.created_at.desc())
        offset = max(0, (page - 1) * COMMUNITY_PAGE_SIZE)
        q = q.offset(offset).limit(COMMUNITY_PAGE_SIZE)
        rows = list((await self.db.execute(q)).scalars().all())

        # Post-filter on education methods (JSON array overlap is dialect-specific).
        if methods:
            wanted = set(methods)
            rows = [
                c for c in rows
                if wanted.intersection(set((c.principle_tags or {}).get("education_methods") or []))
            ]

        total_pages = (total + COMMUNITY_PAGE_SIZE - 1) // COMMUNITY_PAGE_SIZE
        return {"items": rows, "page": page, "total": total, "total_pages": total_pages}

    # ── Membership: join / leave / approve / deny / remove / promote ──

    async def join_or_request(
        self,
        user_id: uuid.UUID,
        slug: str,
        message: Optional[str] = None,
        agreed_to_principles: bool = False,
    ) -> CommunityMember:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)

        if c.join_mode == "invite_only":
            raise HTTPException(status_code=403, detail="This community is invite-only.")
        if c.closed_to_new_members:
            raise HTTPException(
                status_code=403,
                detail="This community is currently closed to new joiners.",
            )
        if not agreed_to_principles:
            raise HTTPException(
                status_code=422,
                detail="Please confirm you've read the description and core principles.",
            )

        clean_message = (message or "").strip() or None
        agreed_at = utcnow()

        existing = await self._get_membership(c.id, family.id)
        if existing and existing.status in ("active", "pending"):
            raise HTTPException(status_code=409, detail="You already have a request or membership.")
        if existing and existing.status == "removed":
            # Re-request after removal/deny — overwrite. Carries the new
            # message + agreement, clears the prior rejection reason so the
            # admin sees a clean pending row.
            existing.status = "pending"
            existing.role = "member"
            existing.joined_at = None
            existing.removed_at = None
            existing.removed_reason = None
            existing.join_message = clean_message
            existing.agreed_to_principles_at = agreed_at
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        active = await self._active_member_count(family.id)
        if active >= MAX_COMMUNITIES_PER_FAMILY:
            raise HTTPException(
                status_code=409,
                detail=f"You are already in {MAX_COMMUNITIES_PER_FAMILY} communities. Leave one to join another.",
            )

        m = CommunityMember(
            community_id=c.id,
            family_id=family.id,
            join_message=clean_message,
            agreed_to_principles_at=agreed_at,
            role="member",
            status="pending",
        )
        self.db.add(m)
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def leave(self, user_id: uuid.UUID, slug: str) -> None:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        member = await self._get_membership(c.id, family.id)
        if not member or member.status != "active":
            raise HTTPException(status_code=404, detail="You are not a member of this community.")

        was_admin = member.role == "admin"
        await self.db.delete(member)
        await self.db.flush()
        c.member_count = max(0, c.member_count - 1)

        if was_admin:
            await self._succession_on_leave(c)
        await self.db.commit()

    async def _succession_on_leave(self, c: Community) -> None:
        """Promote oldest co_admin first, else oldest active member, else soft-delete."""
        res = await self.db.execute(
            select(CommunityMember).where(
                CommunityMember.community_id == c.id,
                CommunityMember.status == "active",
            )
        )
        candidates = list(res.scalars().all())
        candidates.sort(key=lambda m: (0 if m.role == "co_admin" else 1, m.joined_at or utcnow()))
        if not candidates:
            c.deleted_at = utcnow()
            return
        candidates[0].role = "admin"

    async def list_members(self, user_id: uuid.UUID, slug: str) -> dict:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        my = await self._get_membership(c.id, family.id)
        if not my or my.status != "active":
            raise HTTPException(status_code=403, detail="Members only.")

        res = await self.db.execute(
            select(CommunityMember, Family)
            .join(Family, Family.id == CommunityMember.family_id)
            .where(CommunityMember.community_id == c.id)
            .order_by(CommunityMember.status.asc(), CommunityMember.joined_at.asc().nulls_last())
        )
        rows = list(res.all())

        def to_card(m: CommunityMember, f: Family) -> dict:
            return {
                "family_id": f.id,
                "family_name": f.family_name,
                "family_name_slug": f.family_name_slug,
                "shield_config": f.shield_config or None,
                "location_country_code": f.location_country_code,
                "location_region": f.location_region,
                "role": m.role,
                "status": m.status,
                "joined_at": m.joined_at,
                # Surface the request note for pending rows so admins can
                # make an informed approve/deny decision.
                "join_message": m.join_message if m.status == "pending" else None,
            }

        active = [to_card(m, f) for m, f in rows if m.status == "active"]
        pending = (
            [to_card(m, f) for m, f in rows if m.status == "pending"]
            if my.role in ("admin", "co_admin")
            else []
        )
        return {"active": active, "pending": pending}

    async def approve_member(self, user_id: uuid.UUID, slug: str, family_id: uuid.UUID) -> CommunityMember:
        viewer_family, c, my = await self._require_admin(user_id, slug)
        m = await self._get_membership(c.id, family_id)
        if not m or m.status != "pending":
            raise HTTPException(status_code=404, detail="No pending request for that family.")

        active = await self._active_member_count(family_id)
        if active >= MAX_COMMUNITIES_PER_FAMILY:
            raise HTTPException(status_code=409, detail="That family is already in the maximum number of communities.")

        m.status = "active"
        m.joined_at = utcnow()
        c.member_count += 1
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def deny_member(
        self,
        user_id: uuid.UUID,
        slug: str,
        family_id: uuid.UUID,
        reason: str,
    ) -> None:
        viewer_family, c, my = await self._require_admin(user_id, slug)
        m = await self._get_membership(c.id, family_id)
        if not m or m.status != "pending":
            raise HTTPException(status_code=404, detail="No pending request for that family.")
        reason = (reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=422,
                detail="A reason is required when denying a join request.",
            )
        # Keep the row but flip to 'removed' with the reason captured. The
        # original join_message is preserved so the audit picture stays whole.
        m.status = "removed"
        m.removed_at = utcnow()
        m.removed_reason = reason[:500]
        await self.db.commit()

    async def remove_member(self, user_id: uuid.UUID, slug: str, family_id: uuid.UUID) -> None:
        viewer_family, c, my = await self._require_admin(user_id, slug)
        if family_id == viewer_family.id:
            raise HTTPException(status_code=400, detail="Use 'leave' to remove yourself.")
        m = await self._get_membership(c.id, family_id)
        if not m or m.status != "active":
            raise HTTPException(status_code=404, detail="Not a member.")
        # Co-admin can only remove `member`
        if my.role == "co_admin" and m.role != "member":
            raise HTTPException(status_code=403, detail="Co-admins can only remove regular members.")
        if m.role == "admin":
            raise HTTPException(status_code=400, detail="Transfer admin before removing the admin.")

        await self.db.delete(m)
        c.member_count = max(0, c.member_count - 1)
        await self.db.commit()

    async def promote(self, user_id: uuid.UUID, slug: str, family_id: uuid.UUID) -> CommunityMember:
        viewer_family, c, my = await self._require_admin(user_id, slug, primary_only=True)
        m = await self._get_membership(c.id, family_id)
        if not m or m.status != "active" or m.role != "member":
            raise HTTPException(status_code=404, detail="That family is not a regular member.")
        m.role = "co_admin"
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def demote(self, user_id: uuid.UUID, slug: str, family_id: uuid.UUID) -> CommunityMember:
        viewer_family, c, my = await self._require_admin(user_id, slug, primary_only=True)
        m = await self._get_membership(c.id, family_id)
        if not m or m.role != "co_admin":
            raise HTTPException(status_code=404, detail="That family is not a co-admin.")
        m.role = "member"
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def transfer_admin(self, user_id: uuid.UUID, slug: str, to_family_id: uuid.UUID) -> None:
        viewer_family, c, my = await self._require_admin(user_id, slug, primary_only=True)
        if to_family_id == viewer_family.id:
            raise HTTPException(status_code=400, detail="You are already the admin.")
        target = await self._get_membership(c.id, to_family_id)
        if not target or target.status != "active":
            raise HTTPException(status_code=404, detail="Target family is not an active member.")
        # Two-step swap to avoid violating the unique-active-admin partial index
        my.role = "co_admin"
        await self.db.flush()
        target.role = "admin"
        await self.db.commit()

    async def _require_admin(
        self, user_id: uuid.UUID, slug: str, primary_only: bool = False
    ) -> tuple[Family, Community, CommunityMember]:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        my = await self._get_membership(c.id, family.id)
        if not my or my.status != "active":
            raise HTTPException(status_code=403, detail="Members only.")
        if primary_only:
            if my.role != "admin":
                raise HTTPException(status_code=403, detail="Admin only.")
        else:
            if my.role not in ("admin", "co_admin"):
                raise HTTPException(status_code=403, detail="Admin only.")
        return family, c, my

    # ── Invitations ────────────────────────────────────────────────────

    async def create_invitation(
        self, user_id: uuid.UUID, slug: str, data: InvitationCreate
    ) -> tuple[CommunityInvitation, str]:
        family, c, my = await self._require_admin(user_id, slug)
        token = secrets.token_urlsafe(32)
        inv = CommunityInvitation(
            community_id=c.id,
            invited_family_id=data.family_id,
            invited_by_user_id=user_id,
            token_hash=_hash_token(token),
            expires_at=utcnow() + timedelta(days=INVITATION_TTL_DAYS),
        )
        self.db.add(inv)
        await self.db.commit()
        await self.db.refresh(inv)
        return inv, token

    async def list_invitations(self, user_id: uuid.UUID, slug: str) -> list[CommunityInvitation]:
        family, c, my = await self._require_admin(user_id, slug)
        res = await self.db.execute(
            select(CommunityInvitation).where(
                CommunityInvitation.community_id == c.id,
                CommunityInvitation.accepted_at.is_(None),
                CommunityInvitation.revoked_at.is_(None),
            ).order_by(CommunityInvitation.created_at.desc())
        )
        return list(res.scalars().all())

    async def revoke_invitation(
        self, user_id: uuid.UUID, slug: str, invitation_id: uuid.UUID
    ) -> None:
        family, c, my = await self._require_admin(user_id, slug)
        res = await self.db.execute(
            select(CommunityInvitation).where(
                CommunityInvitation.id == invitation_id,
                CommunityInvitation.community_id == c.id,
            )
        )
        inv = res.scalars().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        if inv.revoked_at or inv.accepted_at:
            return
        inv.revoked_at = utcnow()
        await self.db.commit()

    async def accept_invitation(self, user_id: uuid.UUID, token: str) -> Community:
        family = await self.get_family_for_user(user_id)
        token_hash = _hash_token(token)
        res = await self.db.execute(
            select(CommunityInvitation).where(CommunityInvitation.token_hash == token_hash)
        )
        inv = res.scalars().first()
        if not inv or inv.revoked_at or inv.accepted_at or inv.expires_at < utcnow():
            raise HTTPException(status_code=400, detail="Invitation invalid or expired.")
        if inv.invited_family_id is not None and inv.invited_family_id != family.id:
            raise HTTPException(status_code=403, detail="This invitation is for a different family.")

        c = await self.db.get(Community, inv.community_id)
        if not c or c.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Community no longer exists.")

        # Cap
        active = await self._active_member_count(family.id)
        existing = await self._get_membership(c.id, family.id)
        already_active = existing and existing.status == "active"
        if not already_active and active >= MAX_COMMUNITIES_PER_FAMILY:
            raise HTTPException(
                status_code=409,
                detail=f"You are already in {MAX_COMMUNITIES_PER_FAMILY} communities.",
            )

        if existing:
            if existing.status == "active":
                # Idempotent — already a member
                inv.accepted_at = utcnow()
                inv.accepted_by_family_id = family.id
                await self.db.commit()
                return c
            existing.status = "active"
            existing.role = "member"
            existing.joined_at = utcnow()
        else:
            self.db.add(CommunityMember(
                community_id=c.id,
                family_id=family.id,
                role="member",
                status="active",
                joined_at=utcnow(),
            ))
            c.member_count += 1

        inv.accepted_at = utcnow()
        inv.accepted_by_family_id = family.id
        await self.db.commit()
        return c

    # ── Forum ──────────────────────────────────────────────────────────

    async def _require_member(self, user_id: uuid.UUID, slug: str) -> tuple[Family, Community, CommunityMember]:
        family = await self.get_family_for_user(user_id)
        c = await self._get_community(slug)
        my = await self._get_membership(c.id, family.id)
        if not my or my.status != "active":
            raise HTTPException(status_code=403, detail="Members only.")
        return family, c, my

    async def list_topics(self, user_id: uuid.UUID, slug: str, page: int = 1) -> dict:
        family, c, my = await self._require_member(user_id, slug)
        base = (
            select(CommunityTopic, Family.family_name)
            .join(Family, Family.id == CommunityTopic.author_family_id)
            .where(CommunityTopic.community_id == c.id)
        )
        count_q = select(func.count()).select_from(
            select(CommunityTopic.id).where(CommunityTopic.community_id == c.id).subquery()
        )
        total = (await self.db.execute(count_q)).scalar_one()

        q = base.order_by(
            CommunityTopic.is_pinned.desc(),
            CommunityTopic.last_reply_at.desc().nulls_last(),
            CommunityTopic.created_at.desc(),
        )
        offset = max(0, (page - 1) * TOPIC_PAGE_SIZE)
        q = q.offset(offset).limit(TOPIC_PAGE_SIZE)
        rows = list((await self.db.execute(q)).all())

        items = [
            {
                "id": t.id,
                "community_id": t.community_id,
                "author_family_id": t.author_family_id,
                "author_family_name": fn,
                "title": t.title,
                "is_pinned": t.is_pinned,
                "is_locked": t.is_locked,
                "reply_count": t.reply_count,
                "last_reply_at": t.last_reply_at,
                "created_at": t.created_at,
            }
            for t, fn in rows
        ]
        total_pages = (total + TOPIC_PAGE_SIZE - 1) // TOPIC_PAGE_SIZE
        return {"items": items, "page": page, "total": total, "total_pages": total_pages}

    async def create_topic(self, user_id: uuid.UUID, slug: str, data: TopicCreate) -> CommunityTopic:
        family, c, my = await self._require_member(user_id, slug)
        t = CommunityTopic(
            community_id=c.id,
            author_family_id=family.id,
            title=data.title.strip(),
            body=data.body,
            last_reply_at=utcnow(),
        )
        self.db.add(t)
        await self.db.flush()  # need t.id for fan-out
        # Fan out notifications inside the same transaction so we never end up
        # with the post but no notifications.
        from app.services.notification_service import NotificationService
        await NotificationService(self.db).fanout_topic_created(
            community_id=c.id, topic_id=t.id, actor_family_id=family.id,
        )
        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def get_topic(self, user_id: uuid.UUID, slug: str, topic_id: uuid.UUID) -> dict:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(
            select(CommunityTopic, Family.family_name)
            .join(Family, Family.id == CommunityTopic.author_family_id)
            .where(CommunityTopic.id == topic_id, CommunityTopic.community_id == c.id)
        )
        row = res.first()
        if not row:
            raise HTTPException(status_code=404, detail="Topic not found.")
        t, author_name = row

        res2 = await self.db.execute(
            select(CommunityReply, Family.family_name)
            .join(Family, Family.id == CommunityReply.author_family_id)
            .where(CommunityReply.topic_id == t.id)
            .order_by(CommunityReply.created_at.asc())
        )
        replies = []
        for r, rname in res2.all():
            body = r.body
            if r.deleted_at:
                body = "(Deleted by author)" if r.deleted_by == "author" else "(Removed by community admin)"
            replies.append({
                "id": r.id,
                "topic_id": r.topic_id,
                "author_family_id": r.author_family_id,
                "author_family_name": rname,
                "body": body,
                "deleted_at": r.deleted_at,
                "deleted_by": r.deleted_by,
                "edited_at": r.edited_at,
                "created_at": r.created_at,
            })

        body = t.body
        if t.deleted_at:
            body = "(Deleted by author)" if t.deleted_by == "author" else "(Removed by community admin)"

        return {
            "id": t.id,
            "community_id": t.community_id,
            "author_family_id": t.author_family_id,
            "author_family_name": author_name,
            "title": t.title,
            "body": body,
            "is_pinned": t.is_pinned,
            "is_locked": t.is_locked,
            "deleted_at": t.deleted_at,
            "deleted_by": t.deleted_by,
            "edited_at": t.edited_at,
            "created_at": t.created_at,
            "replies": replies,
        }

    async def update_topic(
        self, user_id: uuid.UUID, slug: str, topic_id: uuid.UUID, data: TopicUpdate
    ) -> CommunityTopic:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(
            select(CommunityTopic).where(
                CommunityTopic.id == topic_id, CommunityTopic.community_id == c.id
            )
        )
        t = res.scalars().first()
        if not t:
            raise HTTPException(status_code=404, detail="Topic not found.")

        upd = data.model_dump(exclude_unset=True)
        admin_actions = {"is_pinned", "is_locked"}
        author_actions = {"title", "body"}

        is_author = t.author_family_id == family.id
        is_admin = my.role in ("admin", "co_admin")

        if author_actions & set(upd.keys()):
            if not is_author:
                raise HTTPException(status_code=403, detail="Only the author can edit the topic.")
            if (utcnow() - t.created_at) > timedelta(minutes=EDIT_WINDOW_MINUTES):
                raise HTTPException(status_code=403, detail="Edit window has passed.")
            if "title" in upd:
                t.title = upd["title"]
            if "body" in upd:
                t.body = upd["body"]
            t.edited_at = utcnow()

        if admin_actions & set(upd.keys()):
            if not is_admin:
                raise HTTPException(status_code=403, detail="Admin only.")
            if "is_pinned" in upd:
                t.is_pinned = bool(upd["is_pinned"])
            if "is_locked" in upd:
                t.is_locked = bool(upd["is_locked"])

        await self.db.commit()
        await self.db.refresh(t)
        return t

    async def delete_topic(self, user_id: uuid.UUID, slug: str, topic_id: uuid.UUID) -> None:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(
            select(CommunityTopic).where(
                CommunityTopic.id == topic_id, CommunityTopic.community_id == c.id
            )
        )
        t = res.scalars().first()
        if not t:
            raise HTTPException(status_code=404, detail="Topic not found.")

        if t.author_family_id == family.id:
            t.deleted_at = utcnow()
            t.deleted_by = "author"
        elif my.role in ("admin", "co_admin"):
            t.deleted_at = utcnow()
            t.deleted_by = "community_admin"
        else:
            raise HTTPException(status_code=403, detail="Not allowed.")
        await self.db.commit()

    async def create_reply(
        self, user_id: uuid.UUID, slug: str, topic_id: uuid.UUID, data: ReplyCreate
    ) -> CommunityReply:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(
            select(CommunityTopic).where(
                CommunityTopic.id == topic_id, CommunityTopic.community_id == c.id
            )
        )
        t = res.scalars().first()
        if not t:
            raise HTTPException(status_code=404, detail="Topic not found.")
        if t.is_locked:
            raise HTTPException(status_code=403, detail="Topic is locked.")
        if t.deleted_at:
            raise HTTPException(status_code=400, detail="Cannot reply to a deleted topic.")

        r = CommunityReply(
            topic_id=t.id,
            author_family_id=family.id,
            body=data.body,
        )
        self.db.add(r)
        t.reply_count += 1
        t.last_reply_at = utcnow()
        await self.db.flush()  # need r.id for fan-out
        from app.services.notification_service import NotificationService
        await NotificationService(self.db).fanout_reply_created(
            community_id=c.id, topic_id=t.id, reply_id=r.id, actor_family_id=family.id,
        )
        await self.db.commit()
        await self.db.refresh(r)
        return r

    async def update_reply(
        self, user_id: uuid.UUID, slug: str, reply_id: uuid.UUID, data: ReplyUpdate
    ) -> CommunityReply:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(select(CommunityReply).where(CommunityReply.id == reply_id))
        r = res.scalars().first()
        if not r:
            raise HTTPException(status_code=404, detail="Reply not found.")
        # Confirm reply's topic belongs to community
        res2 = await self.db.execute(select(CommunityTopic).where(CommunityTopic.id == r.topic_id))
        t = res2.scalars().first()
        if not t or t.community_id != c.id:
            raise HTTPException(status_code=404, detail="Reply not found.")
        if r.author_family_id != family.id:
            raise HTTPException(status_code=403, detail="Only the author can edit the reply.")
        if (utcnow() - r.created_at) > timedelta(minutes=EDIT_WINDOW_MINUTES):
            raise HTTPException(status_code=403, detail="Edit window has passed.")
        r.body = data.body
        r.edited_at = utcnow()
        await self.db.commit()
        await self.db.refresh(r)
        return r

    async def delete_reply(self, user_id: uuid.UUID, slug: str, reply_id: uuid.UUID) -> None:
        family, c, my = await self._require_member(user_id, slug)
        res = await self.db.execute(select(CommunityReply).where(CommunityReply.id == reply_id))
        r = res.scalars().first()
        if not r:
            raise HTTPException(status_code=404, detail="Reply not found.")
        res2 = await self.db.execute(select(CommunityTopic).where(CommunityTopic.id == r.topic_id))
        t = res2.scalars().first()
        if not t or t.community_id != c.id:
            raise HTTPException(status_code=404, detail="Reply not found.")

        if r.author_family_id == family.id:
            r.deleted_at = utcnow()
            r.deleted_by = "author"
        elif my.role in ("admin", "co_admin"):
            r.deleted_at = utcnow()
            r.deleted_by = "community_admin"
        else:
            raise HTTPException(status_code=403, detail="Not allowed.")
        await self.db.commit()

    # ── Reports ────────────────────────────────────────────────────────

    async def report(self, user_id: uuid.UUID, slug: str, data: ReportCreate) -> CommunityReport:
        family, c, my = await self._require_member(user_id, slug)
        rep = CommunityReport(
            target_type=data.target_type.value,
            target_id=data.target_id,
            community_id=c.id,
            reporter_family_id=family.id,
            reason=data.reason,
        )
        self.db.add(rep)
        await self.db.commit()
        await self.db.refresh(rep)
        return rep

    # ── Discoverability toggle ─────────────────────────────────────────

    async def set_discoverable(self, user_id: uuid.UUID, discoverable: bool) -> Family:
        family = await self.get_family_for_user(user_id)
        if family.discoverable != discoverable:
            family.discoverable = discoverable
            if discoverable and family.discoverable_set_at is None:
                family.discoverable_set_at = utcnow()
            await self.db.commit()
            await self.db.refresh(family)
        return family

    # ── v2: dashboard summary, admin pending count, mute toggle ───────

    async def dashboard_summary(self, user_id: uuid.UUID) -> list[dict]:
        """Per-community summary for the dashboard widget (v2 spec §9.2).

        Capped at 8 rows. Ordered by last activity desc; ties by name asc.
        """
        family = await self.get_family_for_user(user_id)

        # Communities the family is in (active)
        res = await self.db.execute(
            select(Community, CommunityMember.notifications_muted)
            .join(CommunityMember, CommunityMember.community_id == Community.id)
            .where(
                CommunityMember.family_id == family.id,
                CommunityMember.status == "active",
                Community.deleted_at.is_(None),
            )
        )
        rows = list(res.all())
        if not rows:
            return []

        community_ids = [c.id for c, _ in rows]
        muted_map = {c.id: muted for c, muted in rows}

        # Latest topic per community (single query)
        latest_topic_q = await self.db.execute(
            select(
                CommunityTopic.community_id,
                CommunityTopic.id,
                CommunityTopic.title,
                CommunityTopic.last_reply_at,
                CommunityTopic.created_at,
                CommunityTopic.author_family_id,
                Family.family_name,
            )
            .join(Family, Family.id == CommunityTopic.author_family_id)
            .where(
                CommunityTopic.community_id.in_(community_ids),
                CommunityTopic.deleted_at.is_(None),
            )
            .order_by(
                CommunityTopic.community_id,
                CommunityTopic.last_reply_at.desc().nulls_last(),
                CommunityTopic.created_at.desc(),
            )
        )
        # Take the first row per community (since we ordered by recency desc).
        latest_per_c: dict = {}
        for cid, tid, ttitle, tlast, tcreated, _aid, aname in latest_topic_q.all():
            if cid in latest_per_c:
                continue
            latest_per_c[cid] = {
                "type": "reply" if tlast and tlast > tcreated else "topic",
                "topic_id": tid,
                "topic_title": ttitle,
                "actor_family_name": aname,
                "created_at": tlast or tcreated,
            }

        # Unread notification counts per community for this family
        unread_q = await self.db.execute(
            select(Notification.community_id, func.count())
            .where(
                Notification.recipient_family_id == family.id,
                Notification.read_at.is_(None),
                Notification.community_id.in_(community_ids),
            )
            .group_by(Notification.community_id)
        )
        unread_per_c = {cid: cnt for cid, cnt in unread_q.all()}

        items = []
        for c, _ in rows:
            la = latest_per_c.get(c.id)
            # Muted communities hide the unread chip but still appear.
            unread = 0 if muted_map.get(c.id) else int(unread_per_c.get(c.id, 0))
            items.append({
                "community": {
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
                    "child_age_min": c.child_age_min,
                    "child_age_max": c.child_age_max,
                    "identity": c.identity,
                },
                "unread_count": unread,
                "last_activity": la,
            })

        def sort_key(row):
            la = row["last_activity"]
            return (-(la["created_at"].timestamp() if la else 0), row["community"]["name"].lower())

        items.sort(key=sort_key)
        return items[:8]

    async def admin_pending_count(self, user_id: uuid.UUID) -> int:
        """Total pending join requests across every community where the
        caller's family is admin or co_admin. v2 spec §8."""
        family = await self.get_family_for_user(user_id)
        # Communities where I'm admin/co_admin (active)
        my_admin_q = await self.db.execute(
            select(CommunityMember.community_id).where(
                CommunityMember.family_id == family.id,
                CommunityMember.role.in_(["admin", "co_admin"]),
                CommunityMember.status == "active",
            )
        )
        admin_cids = [row[0] for row in my_admin_q.all()]
        if not admin_cids:
            return 0
        res = await self.db.execute(
            select(func.count()).select_from(CommunityMember).where(
                CommunityMember.community_id.in_(admin_cids),
                CommunityMember.status == "pending",
            )
        )
        return int(res.scalar_one() or 0)

    async def set_mute(self, user_id: uuid.UUID, slug: str, muted: bool) -> bool:
        family, c, me = await self._require_member(user_id, slug)
        if me.notifications_muted != muted:
            me.notifications_muted = muted
            await self.db.commit()
        return me.notifications_muted
