import uuid
from collections import defaultdict
from datetime import datetime, timezone, date, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.child import Child
from app.models.curriculum import Curriculum, CurriculumSubject, ChildCurriculum
from app.models.family import Family
from app.models.project import (
    Project, ProjectChild, ProjectSubject, ProjectMilestone, MilestoneCompletion,
)
from app.models.subject import Subject
from app.models.teaching_log import TeachingLog
from app.schemas.progress import TeachingLogCreate, TeachingLogUpdate


def utcnow():
    return datetime.now(timezone.utc)


def iso_week_start(d: date) -> date:
    """Monday of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


def iso_week_range(d: date) -> tuple[date, date]:
    """(Monday, Sunday) of the ISO week containing d."""
    start = iso_week_start(d)
    return start, start + timedelta(days=6)


class ProgressService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ──

    async def _get_log_owned(self, log_id: uuid.UUID, family_id: uuid.UUID) -> TeachingLog:
        result = await self.db.execute(select(TeachingLog).where(TeachingLog.id == log_id))
        log = result.scalars().first()
        if not log or log.family_id != family_id:
            raise HTTPException(status_code=404, detail="Teaching log not found.")
        return log

    async def _validate_child(self, child_id: uuid.UUID, family_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(Child).where(Child.id == child_id, Child.family_id == family_id)
        )
        if not result.scalars().first():
            raise HTTPException(status_code=404, detail="Child not found.")

    async def _validate_subject(self, subject_id: uuid.UUID, family_id: uuid.UUID) -> None:
        result = await self.db.execute(
            select(Subject).where(
                Subject.id == subject_id,
                or_(Subject.family_id == family_id, Subject.is_platform_subject.is_(True)),
            )
        )
        if not result.scalars().first():
            raise HTTPException(status_code=404, detail="Subject not found.")

    async def _get_family_children(self, family_id: uuid.UUID, include_archived: bool = False) -> list[Child]:
        query = select(Child).where(Child.family_id == family_id)
        if not include_archived:
            query = query.where(Child.archived_at.is_(None))
        result = await self.db.execute(query.order_by(Child.created_at.asc()))
        return list(result.scalars().all())

    async def _active_child_curriculum_subjects(self, family_id: uuid.UUID) -> list[dict]:
        """Return flat list of (child_id, subject_id, subject_name, color, weekly_frequency) for
        every active child × active-curriculum × active curriculum subject."""
        result = await self.db.execute(
            select(
                ChildCurriculum.child_id,
                CurriculumSubject.subject_id,
                Subject.name,
                Subject.color,
                CurriculumSubject.weekly_frequency,
            )
            .join(Curriculum, Curriculum.id == ChildCurriculum.curriculum_id)
            .join(CurriculumSubject, CurriculumSubject.curriculum_id == Curriculum.id)
            .join(Subject, Subject.id == CurriculumSubject.subject_id)
            .join(Child, Child.id == ChildCurriculum.child_id)
            .where(
                Curriculum.family_id == family_id,
                Curriculum.status == "active",
                CurriculumSubject.is_active.is_(True),
                Child.archived_at.is_(None),
            )
        )
        return [
            {
                "child_id": row.child_id,
                "subject_id": row.subject_id,
                "name": row.name,
                "color": row.color,
                "weekly_frequency": row.weekly_frequency,
            }
            for row in result.all()
        ]

    # ── CRUD ──

    async def create_log(
        self, family_id: uuid.UUID, user_id: uuid.UUID, data: TeachingLogCreate
    ) -> TeachingLog:
        today = date.today()
        if data.taught_on > today:
            raise HTTPException(status_code=400, detail="taught_on cannot be in the future.")
        if (today - data.taught_on).days > 365:
            raise HTTPException(status_code=400, detail="taught_on cannot be more than 365 days in the past.")

        if data.child_id:
            await self._validate_child(data.child_id, family_id)
        if data.subject_id:
            await self._validate_subject(data.subject_id, family_id)

        # Check duplicate (COALESCE uniqueness handled by DB too, but give a friendly error).
        dup_q = select(TeachingLog).where(
            TeachingLog.family_id == family_id,
            TeachingLog.taught_on == data.taught_on,
            TeachingLog.child_id.is_(data.child_id) if data.child_id is None else TeachingLog.child_id == data.child_id,
            TeachingLog.subject_id.is_(data.subject_id) if data.subject_id is None else TeachingLog.subject_id == data.subject_id,
        )
        existing = await self.db.execute(dup_q)
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="You already logged that combination for this day.")

        log = TeachingLog(
            family_id=family_id,
            taught_on=data.taught_on,
            child_id=data.child_id,
            subject_id=data.subject_id,
            minutes=data.minutes,
            notes=data.notes,
            logged_by_user_id=user_id,
        )
        self.db.add(log)
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise HTTPException(status_code=409, detail="You already logged that combination for this day.")
        await self.db.refresh(log)
        return log

    async def list_logs(
        self,
        family_id: uuid.UUID,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        child_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
    ) -> list[TeachingLog]:
        query = select(TeachingLog).where(TeachingLog.family_id == family_id)
        if from_date:
            query = query.where(TeachingLog.taught_on >= from_date)
        if to_date:
            query = query.where(TeachingLog.taught_on <= to_date)
        if child_id:
            query = query.where(TeachingLog.child_id == child_id)
        if subject_id:
            query = query.where(TeachingLog.subject_id == subject_id)
        query = query.order_by(TeachingLog.taught_on.desc(), TeachingLog.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_log(
        self, log_id: uuid.UUID, family_id: uuid.UUID, data: TeachingLogUpdate
    ) -> TeachingLog:
        log = await self._get_log_owned(log_id, family_id)
        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(log, k, v)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def delete_log(self, log_id: uuid.UUID, family_id: uuid.UUID) -> None:
        log = await self._get_log_owned(log_id, family_id)
        await self.db.delete(log)
        await self.db.commit()

    # ── Streak / summary ──

    def _weeks_between(self, earliest: date, latest: date) -> list[date]:
        """Return list of Monday dates covering earliest..latest (inclusive), oldest first."""
        start = iso_week_start(earliest)
        end = iso_week_start(latest)
        weeks: list[date] = []
        cur = start
        while cur <= end:
            weeks.append(cur)
            cur += timedelta(days=7)
        return weeks

    def _compute_streak(
        self,
        week_counts: dict[date, int],
        weekly_target: int,
        today: date,
    ) -> tuple[Optional[int], Optional[int], Optional[date]]:
        """Return (current_weeks, longest_weeks, last_met_week_start).

        current_weeks: consecutive met weeks ending at this week OR last week.
        longest_weeks: longest consecutive run over all known weeks.
        """
        if weekly_target <= 0:
            return None, None, None

        if not week_counts:
            return 0, 0, None

        sorted_weeks = sorted(week_counts.keys())
        this_week = iso_week_start(today)
        last_week = this_week - timedelta(days=7)

        # Build sequence for every week between the earliest data and this week
        earliest = sorted_weeks[0]
        full_seq: list[date] = []
        cur = earliest
        while cur <= this_week:
            full_seq.append(cur)
            cur += timedelta(days=7)

        met = {w: (week_counts.get(w, 0) >= weekly_target) for w in full_seq}

        # Current streak: walk back from this week (if met) or from last week otherwise.
        start_idx = len(full_seq) - 1  # this_week index
        if not met[this_week]:
            start_idx -= 1  # start from last_week

        current = 0
        if start_idx >= 0:
            for i in range(start_idx, -1, -1):
                if met[full_seq[i]]:
                    current += 1
                else:
                    break

        # Longest run across all weeks.
        longest = 0
        run = 0
        for w in full_seq:
            if met[w]:
                run += 1
                longest = max(longest, run)
            else:
                run = 0

        # Last met week start (most recent met week <= today).
        last_met: Optional[date] = None
        for w in reversed(full_seq):
            if met[w]:
                last_met = w
                break

        return current, longest, last_met

    async def get_summary(
        self,
        family_id: uuid.UUID,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        child_filter_id: Optional[uuid.UUID] = None,
    ) -> dict:
        today = date.today()
        if to_date is None:
            to_date = today
        if from_date is None:
            from_date = to_date - timedelta(days=90)

        if child_filter_id:
            await self._validate_child(child_filter_id, family_id)

        # Load all logs for the family (entire history — needed for longest streak).
        log_query = select(TeachingLog).where(TeachingLog.family_id == family_id)
        if child_filter_id:
            # Narrowing to a child includes logs that target that child AND general-scope logs.
            log_query = log_query.where(
                or_(TeachingLog.child_id == child_filter_id, TeachingLog.child_id.is_(None))
            )
        all_logs = list((await self.db.execute(log_query)).scalars().all())

        # Scope data.
        active_rows = await self._active_child_curriculum_subjects(family_id)
        if child_filter_id:
            active_rows = [r for r in active_rows if r["child_id"] == child_filter_id]

        # Weekly targets.
        overall_target = sum(r["weekly_frequency"] for r in active_rows)

        per_child_targets: dict[uuid.UUID, int] = defaultdict(int)
        for r in active_rows:
            per_child_targets[r["child_id"]] += r["weekly_frequency"]

        per_subject_targets: dict[uuid.UUID, int] = defaultdict(int)
        subject_meta: dict[uuid.UUID, dict] = {}
        for r in active_rows:
            per_subject_targets[r["subject_id"]] += r["weekly_frequency"]
            subject_meta[r["subject_id"]] = {"name": r["name"], "color": r["color"]}

        # Pre-bucket logs by week for each scope.
        overall_weeks: dict[date, int] = defaultdict(int)
        per_child_weeks: dict[uuid.UUID, dict[date, int]] = defaultdict(lambda: defaultdict(int))
        per_subject_weeks: dict[uuid.UUID, dict[date, int]] = defaultdict(lambda: defaultdict(int))

        this_week_start = iso_week_start(today)
        overall_this_week_count = 0
        per_child_this_week: dict[uuid.UUID, int] = defaultdict(int)
        per_subject_this_week: dict[uuid.UUID, int] = defaultdict(int)

        # Active children & tracked subjects — used to fan a "general" log (null child
        # or null subject) out to every active child / tracked subject. Logging
        # "General" means everything was taught that day.
        children_for_scope = await self._get_family_children(family_id)
        if child_filter_id:
            children_for_scope = [c for c in children_for_scope if c.id == child_filter_id]
        active_child_ids = [c.id for c in children_for_scope]
        tracked_subject_ids = list(per_subject_targets.keys())

        for log in all_logs:
            wk = iso_week_start(log.taught_on)
            overall_weeks[wk] += 1
            if wk == this_week_start:
                overall_this_week_count += 1

            # Per-child: specific child → that child; general → all active children.
            target_child_ids = [log.child_id] if log.child_id is not None else active_child_ids
            for cid in target_child_ids:
                per_child_weeks[cid][wk] += 1
                if wk == this_week_start:
                    per_child_this_week[cid] += 1

            # Per-subject: specific subject → that subject; general → every tracked subject.
            target_subject_ids = [log.subject_id] if log.subject_id is not None else tracked_subject_ids
            for sid in target_subject_ids:
                per_subject_weeks[sid][wk] += 1
                if wk == this_week_start:
                    per_subject_this_week[sid] += 1

        # Overall streak.
        overall_current, overall_longest, overall_last_met = (None, None, None)
        if overall_target > 0:
            overall_current, overall_longest, overall_last_met = self._compute_streak(
                overall_weeks, overall_target, today
            )

        overall_streak = {
            "current_weeks": overall_current,
            "longest_weeks": overall_longest,
            "weekly_target": overall_target if overall_target > 0 else None,
            "this_week_count": overall_this_week_count,
            "last_met_week_start": overall_last_met,
        }

        # Per-child streaks (reuse children_for_scope loaded above).
        children = children_for_scope

        per_child_streaks = []
        for c in children:
            tgt = per_child_targets.get(c.id, 0)
            cur, lng, _ = self._compute_streak(per_child_weeks.get(c.id, {}), tgt, today)
            per_child_streaks.append({
                "child_id": c.id,
                "first_name": c.nickname or c.first_name,
                "current_weeks": cur,
                "longest_weeks": lng,
                "weekly_target": tgt if tgt > 0 else None,
                "this_week_count": per_child_this_week.get(c.id, 0),
            })

        # Per-subject streaks (only subjects with target > 0).
        per_subject_streaks = []
        for sid, tgt in per_subject_targets.items():
            if tgt <= 0:
                continue
            meta = subject_meta.get(sid, {"name": "", "color": "#6366F1"})
            cur, lng, _ = self._compute_streak(per_subject_weeks.get(sid, {}), tgt, today)
            per_subject_streaks.append({
                "subject_id": sid,
                "name": meta["name"],
                "color": meta["color"],
                "current_weeks": cur,
                "longest_weeks": lng,
                "weekly_target": tgt,
                "this_week_count": per_subject_this_week.get(sid, 0),
            })
        per_subject_streaks.sort(key=lambda s: s["name"].lower())

        # Teach counts within the requested range.
        in_range = [l for l in all_logs if from_date <= l.taught_on <= to_date]
        total = len(in_range)

        count_by_child: dict[uuid.UUID, int] = defaultdict(int)
        count_by_subject: dict[uuid.UUID, int] = defaultdict(int)
        heatmap_counts: dict[date, int] = defaultdict(int)
        for l in in_range:
            if l.child_id is not None:
                count_by_child[l.child_id] += 1
            if l.subject_id is not None:
                count_by_subject[l.subject_id] += 1
            heatmap_counts[l.taught_on] += 1

        # Subject name/color map for teach counts (use meta, fall back to Subject fetch).
        missing_subject_ids = [sid for sid in count_by_subject.keys() if sid not in subject_meta]
        if missing_subject_ids:
            subj_result = await self.db.execute(select(Subject).where(Subject.id.in_(missing_subject_ids)))
            for s in subj_result.scalars().all():
                subject_meta[s.id] = {"name": s.name, "color": s.color}

        child_meta = {c.id: (c.nickname or c.first_name) for c in children}
        # Children may have archived entries — still show counts if they have logs.
        all_children = await self._get_family_children(family_id, include_archived=True)
        for c in all_children:
            if c.id not in child_meta and c.id in count_by_child:
                child_meta[c.id] = c.nickname or c.first_name

        by_child_list = [
            {"child_id": cid, "first_name": child_meta.get(cid, ""), "count": cnt}
            for cid, cnt in count_by_child.items()
        ]
        by_child_list.sort(key=lambda x: x["count"], reverse=True)

        by_subject_list = [
            {
                "subject_id": sid,
                "name": subject_meta.get(sid, {}).get("name", ""),
                "color": subject_meta.get(sid, {}).get("color", "#6366F1"),
                "count": cnt,
            }
            for sid, cnt in count_by_subject.items()
        ]
        by_subject_list.sort(key=lambda x: x["count"], reverse=True)

        heatmap = [
            {"date": d, "count": c}
            for d, c in sorted(heatmap_counts.items())
        ]

        return {
            "range": {"from": from_date, "to": to_date},
            "overall_streak": overall_streak,
            "per_child_streaks": per_child_streaks,
            "per_subject_streaks": per_subject_streaks,
            "teach_counts": {
                "total": total,
                "by_child": by_child_list,
                "by_subject": by_subject_list,
            },
            "heatmap": heatmap,
        }

    # ── Report ──

    async def get_report(
        self,
        family_id: uuid.UUID,
        from_date: date,
        to_date: date,
        child_filter_id: Optional[uuid.UUID] = None,
    ) -> dict:
        if child_filter_id:
            await self._validate_child(child_filter_id, family_id)

        # Family.
        fam_result = await self.db.execute(select(Family).where(Family.id == family_id))
        family = fam_result.scalars().first()
        if not family:
            raise HTTPException(status_code=404, detail="Family not found.")

        location_parts = [family.location_city, family.location_region, family.location_country]
        location = ", ".join([p for p in location_parts if p]) or None

        # Children.
        children = await self._get_family_children(family_id, include_archived=True)
        if child_filter_id:
            children = [c for c in children if c.id == child_filter_id]

        child_ids_in_scope = {c.id for c in children}

        # Curricula overlapping the range.
        cur_query = select(Curriculum).where(
            Curriculum.family_id == family_id,
            Curriculum.start_date <= to_date,
            Curriculum.end_date >= from_date,
        ).order_by(Curriculum.start_date.asc())
        curricula_rows = list((await self.db.execute(cur_query)).scalars().all())

        # Curriculum subjects & enrollments.
        curricula_out = []
        subject_meta: dict[uuid.UUID, dict] = {}
        for cur in curricula_rows:
            cs_result = await self.db.execute(
                select(CurriculumSubject, Subject)
                .join(Subject, Subject.id == CurriculumSubject.subject_id)
                .where(
                    CurriculumSubject.curriculum_id == cur.id,
                    CurriculumSubject.is_active.is_(True),
                )
                .order_by(CurriculumSubject.sort_order.asc(), Subject.name.asc())
            )
            subjects_out = []
            for cs, subj in cs_result.all():
                subject_meta[subj.id] = {"name": subj.name, "color": subj.color}
                subjects_out.append({
                    "subject_id": subj.id,
                    "name": subj.name,
                    "color": subj.color,
                    "weekly_frequency": cs.weekly_frequency,
                    "goals_for_period": list(cs.goals_for_period or []),
                })

            enroll_result = await self.db.execute(
                select(ChildCurriculum.child_id).where(ChildCurriculum.curriculum_id == cur.id)
            )
            enrolled_ids = [row[0] for row in enroll_result.all()]
            if child_filter_id and child_filter_id not in enrolled_ids:
                continue
            if child_filter_id:
                enrolled_ids = [child_filter_id]

            curricula_out.append({
                "id": cur.id,
                "name": cur.name,
                "period_type": cur.period_type,
                "start_date": cur.start_date,
                "end_date": cur.end_date,
                "status": cur.status,
                "subjects": subjects_out,
                "enrolled_child_ids": enrolled_ids,
            })

        # Projects touching the range (completed in range OR active with due_date in range OR not archived and overlapping).
        proj_query = select(Project).where(
            Project.family_id == family_id,
            Project.archived_at.is_(None),
        ).order_by(Project.due_date.asc().nulls_last(), Project.created_at.asc())
        projects_all = list((await self.db.execute(proj_query)).scalars().all())

        projects_out = []
        for p in projects_all:
            # Project children.
            pc_result = await self.db.execute(
                select(ProjectChild.child_id).where(ProjectChild.project_id == p.id)
            )
            proj_child_ids = [row[0] for row in pc_result.all()]
            if child_filter_id and child_filter_id not in proj_child_ids:
                continue

            ps_result = await self.db.execute(
                select(ProjectSubject.subject_id).where(ProjectSubject.project_id == p.id)
            )
            proj_subject_ids = [row[0] for row in ps_result.all()]

            mi_result = await self.db.execute(
                select(ProjectMilestone)
                .where(ProjectMilestone.project_id == p.id)
                .order_by(ProjectMilestone.sort_order.asc())
            )
            milestones = list(mi_result.scalars().all())

            milestone_ids = [m.id for m in milestones]
            completions_by_ms: dict[uuid.UUID, list] = defaultdict(list)
            if milestone_ids:
                comp_result = await self.db.execute(
                    select(MilestoneCompletion).where(
                        MilestoneCompletion.milestone_id.in_(milestone_ids)
                    )
                )
                for comp in comp_result.scalars().all():
                    completions_by_ms[comp.milestone_id].append(comp)

            ms_out = []
            any_activity_in_range = False
            for m in milestones:
                comps = [
                    {"child_id": c.child_id, "completed_at": c.completed_at}
                    for c in completions_by_ms.get(m.id, [])
                    if (not child_filter_id or c.child_id == child_filter_id)
                ]
                for c in comps:
                    d = c["completed_at"].date() if hasattr(c["completed_at"], "date") else c["completed_at"]
                    if from_date <= d <= to_date:
                        any_activity_in_range = True
                ms_out.append({
                    "id": m.id,
                    "title": m.title,
                    "due_date": m.due_date,
                    "completions": comps,
                })

            # Include project if due in range, completed in range, or has completions in range.
            in_scope = False
            if p.due_date and from_date <= p.due_date <= to_date:
                in_scope = True
            if p.completed_at and from_date <= p.completed_at.date() <= to_date:
                in_scope = True
            if any_activity_in_range:
                in_scope = True
            if not in_scope:
                continue

            projects_out.append({
                "id": p.id,
                "title": p.title,
                "status": p.status,
                "due_date": p.due_date,
                "child_ids": proj_child_ids,
                "subject_ids": proj_subject_ids,
                "milestones": ms_out,
            })

        # Teach counts.
        log_q = select(TeachingLog).where(
            TeachingLog.family_id == family_id,
            TeachingLog.taught_on >= from_date,
            TeachingLog.taught_on <= to_date,
        )
        if child_filter_id:
            log_q = log_q.where(
                or_(TeachingLog.child_id == child_filter_id, TeachingLog.child_id.is_(None))
            )
        logs = list((await self.db.execute(log_q)).scalars().all())

        total_entries = len(logs)
        distinct_days = {l.taught_on for l in logs}
        days_with_any_log = len(distinct_days)
        range_days = (to_date - from_date).days + 1

        # Resolve missing subject/child names.
        missing_subject_ids = {l.subject_id for l in logs if l.subject_id and l.subject_id not in subject_meta}
        if missing_subject_ids:
            sres = await self.db.execute(select(Subject).where(Subject.id.in_(list(missing_subject_ids))))
            for s in sres.scalars().all():
                subject_meta[s.id] = {"name": s.name, "color": s.color}

        # Subject totals.
        subject_totals: dict[uuid.UUID, int] = defaultdict(int)
        for l in logs:
            if l.subject_id:
                subject_totals[l.subject_id] += 1
        by_subject = [
            {"subject_id": sid, "name": subject_meta.get(sid, {}).get("name", ""), "count": cnt}
            for sid, cnt in subject_totals.items()
        ]
        by_subject.sort(key=lambda x: x["count"], reverse=True)

        # Per-child totals + per-child/per-subject breakdown.
        by_child_list = []
        child_map = {c.id: c for c in children}
        all_child_ids = {l.child_id for l in logs if l.child_id} | set(child_map.keys())

        for cid in all_child_ids:
            child = child_map.get(cid)
            if not child:
                extra = await self.db.execute(select(Child).where(Child.id == cid))
                child = extra.scalars().first()
                if not child or child.family_id != family_id:
                    continue
            ch_logs = [l for l in logs if l.child_id == cid]
            total = len(ch_logs)
            per_subj: dict[uuid.UUID, int] = defaultdict(int)
            for l in ch_logs:
                if l.subject_id:
                    per_subj[l.subject_id] += 1
            by_subj_for_child = [
                {"subject_id": sid, "name": subject_meta.get(sid, {}).get("name", ""), "count": cnt}
                for sid, cnt in per_subj.items()
            ]
            by_subj_for_child.sort(key=lambda x: x["count"], reverse=True)
            by_child_list.append({
                "child_id": cid,
                "first_name": child.nickname or child.first_name,
                "total": total,
                "by_subject": by_subj_for_child,
            })
        by_child_list.sort(key=lambda x: x["total"], reverse=True)

        return {
            "generated_at": utcnow(),
            "range": {"from": from_date, "to": to_date},
            "family": {
                "family_name": family.family_name,
                "shield_config": family.shield_config or None,
                "location": location,
            },
            "children": [
                {
                    "id": c.id,
                    "first_name": c.nickname or c.first_name,
                    "grade_level": c.grade_level,
                    "is_active": c.archived_at is None and c.is_active,
                }
                for c in children
            ],
            "curricula": curricula_out,
            "projects": projects_out,
            "teach_counts": {
                "range_days": range_days,
                "days_with_any_log": days_with_any_log,
                "total_entries": total_entries,
                "by_child": by_child_list,
                "by_subject": by_subject,
            },
        }
