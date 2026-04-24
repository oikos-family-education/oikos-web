import uuid
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException

from app.models.family import Family
from app.models.family_member import FamilyMember, FamilyInvitation
from app.models.user import User


INVITATION_TTL_DAYS = 7
MAX_MEMBERS_PER_FAMILY = 2


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class FamilyMembersService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _require_primary(self, user_id: uuid.UUID, family_id: uuid.UUID) -> None:
        res = await self.db.execute(
            select(FamilyMember.role).where(
                FamilyMember.user_id == user_id,
                FamilyMember.family_id == family_id,
            )
        )
        role = res.scalars().first()
        if role != "primary":
            raise HTTPException(status_code=403, detail="Only the primary account holder can do this.")

    async def list_members(self, family_id: uuid.UUID) -> list[dict]:
        # Members
        mres = await self.db.execute(
            select(FamilyMember, User)
            .join(User, User.id == FamilyMember.user_id)
            .where(FamilyMember.family_id == family_id)
            .order_by(FamilyMember.joined_at.asc())
        )
        members_rows = list(mres.all())

        # Pending/expired invitations
        ires = await self.db.execute(
            select(FamilyInvitation)
            .where(
                FamilyInvitation.family_id == family_id,
                FamilyInvitation.accepted_at.is_(None),
                FamilyInvitation.revoked_at.is_(None),
            )
            .order_by(FamilyInvitation.created_at.desc())
        )
        invitations = list(ires.scalars().all())

        out: list[dict] = []
        for member, user in members_rows:
            out.append({
                "kind": "member",
                "id": member.id,
                "user_id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": member.role,
                "status": "active",
                "joined_at": member.joined_at,
                "invited_at": None,
                "expires_at": None,
            })

        now = _now()
        for inv in invitations:
            expired = inv.expires_at < now
            out.append({
                "kind": "invitation",
                "id": inv.id,
                "user_id": None,
                "email": inv.email,
                "first_name": None,
                "last_name": None,
                "role": "co_parent",
                "status": "expired" if expired else "pending",
                "joined_at": None,
                "invited_at": inv.created_at,
                "expires_at": inv.expires_at,
            })

        return out

    async def invite(self, family_id: uuid.UUID, invited_by_user_id: uuid.UUID, email: str) -> tuple[FamilyInvitation, str]:
        await self._require_primary(invited_by_user_id, family_id)

        email = email.strip().lower()

        # Check that the family isn't full
        cnt = await self.db.execute(select(FamilyMember).where(FamilyMember.family_id == family_id))
        current_members = list(cnt.scalars().all())
        if len(current_members) >= MAX_MEMBERS_PER_FAMILY:
            raise HTTPException(status_code=409, detail="This family already has the maximum number of members.")

        # Reject if inviting someone already in this family
        for m in current_members:
            ures = await self.db.execute(select(User).where(User.id == m.user_id))
            u = ures.scalars().first()
            if u and u.email.lower() == email:
                raise HTTPException(status_code=409, detail="This person already belongs to the family.")

        # Reject if there's a pending, non-expired invite for this email already
        now = _now()
        pres = await self.db.execute(
            select(FamilyInvitation).where(
                FamilyInvitation.family_id == family_id,
                FamilyInvitation.email == email,
                FamilyInvitation.accepted_at.is_(None),
                FamilyInvitation.revoked_at.is_(None),
                FamilyInvitation.expires_at > now,
            )
        )
        if pres.scalars().first():
            raise HTTPException(status_code=409, detail="A pending invitation for this email already exists.")

        token = secrets.token_urlsafe(32)
        invitation = FamilyInvitation(
            family_id=family_id,
            email=email,
            token_hash=_hash_token(token),
            invited_by_user_id=invited_by_user_id,
            expires_at=now + timedelta(days=INVITATION_TTL_DAYS),
        )
        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)
        return invitation, token

    async def resend(self, family_id: uuid.UUID, user_id: uuid.UUID, invitation_id: uuid.UUID) -> tuple[FamilyInvitation, str]:
        await self._require_primary(user_id, family_id)

        res = await self.db.execute(
            select(FamilyInvitation).where(
                FamilyInvitation.id == invitation_id,
                FamilyInvitation.family_id == family_id,
            )
        )
        inv = res.scalars().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        if inv.accepted_at is not None:
            raise HTTPException(status_code=400, detail="Invitation already accepted.")

        token = secrets.token_urlsafe(32)
        inv.token_hash = _hash_token(token)
        inv.expires_at = _now() + timedelta(days=INVITATION_TTL_DAYS)
        inv.revoked_at = None
        await self.db.commit()
        await self.db.refresh(inv)
        return inv, token

    async def revoke(self, family_id: uuid.UUID, user_id: uuid.UUID, invitation_id: uuid.UUID) -> None:
        await self._require_primary(user_id, family_id)

        res = await self.db.execute(
            select(FamilyInvitation).where(
                FamilyInvitation.id == invitation_id,
                FamilyInvitation.family_id == family_id,
            )
        )
        inv = res.scalars().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        if inv.accepted_at is not None:
            raise HTTPException(status_code=400, detail="Invitation already accepted; cannot revoke.")

        inv.revoked_at = _now()
        await self.db.commit()

    async def remove_member(self, family_id: uuid.UUID, actor_user_id: uuid.UUID, target_user_id: uuid.UUID) -> None:
        await self._require_primary(actor_user_id, family_id)

        res = await self.db.execute(
            select(FamilyMember).where(
                FamilyMember.family_id == family_id,
                FamilyMember.user_id == target_user_id,
            )
        )
        member = res.scalars().first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found.")
        if member.role == "primary":
            raise HTTPException(status_code=403, detail="The primary account holder cannot be removed.")

        await self.db.delete(member)

        # Recompute has_family on that user
        ures = await self.db.execute(select(User).where(User.id == target_user_id))
        user = ures.scalars().first()
        if user:
            still_member = await self.db.execute(
                select(FamilyMember.id).where(FamilyMember.user_id == target_user_id)
            )
            if not still_member.scalars().first():
                user.has_family = False

        await self.db.commit()

    async def leave(self, family_id: uuid.UUID, user_id: uuid.UUID) -> None:
        res = await self.db.execute(
            select(FamilyMember).where(
                FamilyMember.family_id == family_id,
                FamilyMember.user_id == user_id,
            )
        )
        member = res.scalars().first()
        if not member:
            raise HTTPException(status_code=404, detail="You are not a member of this family.")
        if member.role == "primary":
            raise HTTPException(status_code=403, detail="The primary account holder cannot leave the family; delete it instead.")

        await self.db.delete(member)

        ures = await self.db.execute(select(User).where(User.id == user_id))
        user = ures.scalars().first()
        if user:
            still_member = await self.db.execute(
                select(FamilyMember.id).where(FamilyMember.user_id == user_id)
            )
            if not still_member.scalars().first():
                user.has_family = False

        await self.db.commit()

    async def accept_invitation(self, user_id: uuid.UUID, token: str) -> Family:
        token_hash = _hash_token(token)
        res = await self.db.execute(
            select(FamilyInvitation).where(FamilyInvitation.token_hash == token_hash)
        )
        inv = res.scalars().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        if inv.revoked_at is not None:
            raise HTTPException(status_code=410, detail="This invitation has been revoked.")
        if inv.accepted_at is not None:
            raise HTTPException(status_code=410, detail="This invitation has already been used.")
        if inv.expires_at < _now():
            raise HTTPException(status_code=410, detail="This invitation has expired.")

        # Check user isn't already in a family
        existing = await self.db.execute(
            select(FamilyMember).where(FamilyMember.user_id == user_id)
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="You already belong to a family. Leave it first to accept this invitation.")

        # Check family has room
        cnt = await self.db.execute(select(FamilyMember).where(FamilyMember.family_id == inv.family_id))
        if len(list(cnt.scalars().all())) >= MAX_MEMBERS_PER_FAMILY:
            raise HTTPException(status_code=409, detail="This family is full.")

        self.db.add(FamilyMember(family_id=inv.family_id, user_id=user_id, role="co_parent"))
        inv.accepted_at = _now()

        # Mark user.has_family = True
        ures = await self.db.execute(select(User).where(User.id == user_id))
        user = ures.scalars().first()
        if user:
            user.has_family = True

        await self.db.commit()

        fres = await self.db.execute(select(Family).where(Family.id == inv.family_id))
        return fres.scalars().first()
