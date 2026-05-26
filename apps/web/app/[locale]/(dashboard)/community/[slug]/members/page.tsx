'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { Link } from '../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../lib/apiFetch';
import { CommunityTabs } from '../../../../../../components/community/CommunityTabs';
import { InviteDialog } from '../../../../../../components/community/InviteDialog';
import type { CommunityDetail, MembersList } from '../../../../../../components/community/types';

export default function MembersPage() {
  const t = useTranslations('Community');
  const tM = useTranslations('Community.members');
  const params = useParams();
  const slug = params.slug as string;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<MembersList | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [acting, setActing] = useState(false);

  async function reload() {
    const [c, m] = await Promise.all([
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/members`).then((r) => (r.ok ? r.json() : null)),
    ]);
    setCommunity(c);
    setMembers(m);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(path: string) {
    setActing(true);
    try {
      await apiFetch(path, { method: 'POST' });
      await reload();
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!community || !members) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Not available.
      </p>
    );
  }

  const isAdmin = community.viewer_role === 'admin';
  const isCoAdmin = community.viewer_role === 'co_admin';
  const canManage = isAdmin || isCoAdmin;

  return (
    <div className="max-w-5xl">
      <Link href={`/community/${slug}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {community.name}
      </Link>

      <CommunityTabs slug={slug} canSettings={canManage} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          {tM('active')} · {members.active.length}
        </h2>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <UserPlus className="w-4 h-4" />
            {tM('invite')}
          </button>
        )}
      </div>

      {members.active.length === 0 ? (
        <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
          {tM('noActive')}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {members.active.map((m) => (
            <div key={m.family_id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <Link
                  href={`/discover/${m.family_name_slug}`}
                  className="text-sm font-semibold text-slate-800 hover:text-primary"
                >
                  {m.family_name}
                </Link>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {t(`role.${m.role}`)}
                </span>
              </div>
              {(m.location_region || m.location_country_code) && (
                <p className="text-xs text-slate-500 mb-2">
                  {[m.location_region, m.location_country_code].filter(Boolean).join(', ')}
                </p>
              )}
              {canManage && m.role !== 'admin' && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
                  {isAdmin && m.role === 'member' && (
                    <button
                      onClick={() => act(`/api/v1/communities/${slug}/members/${m.family_id}/promote`)}
                      disabled={acting}
                      className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {tM('promote')}
                    </button>
                  )}
                  {isAdmin && m.role === 'co_admin' && (
                    <button
                      onClick={() => act(`/api/v1/communities/${slug}/members/${m.family_id}/demote`)}
                      disabled={acting}
                      className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {tM('demote')}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => act(`/api/v1/communities/${slug}/transfer-admin`)}
                      disabled={acting}
                      className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {tM('transfer')}
                    </button>
                  )}
                  <button
                    onClick={() => act(`/api/v1/communities/${slug}/members/${m.family_id}/remove`)}
                    disabled={acting}
                    className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                  >
                    {tM('remove')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">
            {tM('pending')} · {members.pending.length}
          </h2>
          {members.pending.length === 0 ? (
            <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
              {tM('noPending')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.pending.map((m) => (
                <div key={m.family_id} className="bg-white rounded-xl border border-amber-200 p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-2">{m.family_name}</p>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => act(`/api/v1/communities/${slug}/members/${m.family_id}/approve`)}
                      disabled={acting}
                      className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary-hover"
                    >
                      {tM('approve')}
                    </button>
                    <button
                      onClick={() => act(`/api/v1/communities/${slug}/members/${m.family_id}/deny`)}
                      disabled={acting}
                      className="text-xs px-3 py-1 border border-slate-200 rounded hover:bg-slate-50"
                    >
                      {tM('deny')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} slug={slug} />
    </div>
  );
}
