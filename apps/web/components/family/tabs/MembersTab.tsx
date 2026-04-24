'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input, Button } from '@oikos/ui';
import { AlertTriangle, Loader2, Mail, UserPlus, Users } from 'lucide-react';

interface Member {
  kind: 'member' | 'invitation';
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'primary' | 'co_parent';
  status: 'active' | 'pending' | 'expired';
  joined_at: string | null;
  invited_at: string | null;
  expires_at: string | null;
}

function initialsOf(m: Member): string {
  if (m.first_name || m.last_name) {
    return `${(m.first_name || '')[0] ?? ''}${(m.last_name || '')[0] ?? ''}`.toUpperCase() || m.email[0].toUpperCase();
  }
  return m.email.slice(0, 2).toUpperCase();
}

function nameOf(m: Member): string {
  const n = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
  return n || m.email;
}

export function MembersTab() {
  const t = useTranslations('Family');

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [confirmingRemove, setConfirmingRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/families/me/members', { credentials: 'include' });
      if (res.ok) {
        setMembers(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasCoParentSlot = !members.some((m) => m.kind === 'member' && m.role === 'co_parent')
    && !members.some((m) => m.kind === 'invitation' && m.status === 'pending');

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setInviteError('');
    setInviteSuccess('');
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setEmailError(t('inviteError'));
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/v1/families/me/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteError(typeof data.detail === 'string' ? data.detail : t('inviteError'));
        return;
      }
      setInviteSuccess(t('inviteSuccess', { email: trimmed }));
      setEmail('');
      setConsent(false);
      await load();
    } catch {
      setInviteError(t('inviteError'));
    } finally {
      setSending(false);
    }
  };

  const cancelInvitation = async (m: Member) => {
    await fetch(`/api/v1/families/me/members/invite/${m.id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  };

  const resendInvitation = async (m: Member) => {
    await fetch(`/api/v1/families/me/members/invite/${m.id}/resend`, { method: 'POST', credentials: 'include' });
    await load();
  };

  const removeMember = async () => {
    if (!confirmingRemove || !confirmingRemove.user_id) return;
    setRemoving(true);
    try {
      await fetch(`/api/v1/families/me/members/${confirmingRemove.user_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setConfirmingRemove(null);
      await load();
    } finally {
      setRemoving(false);
    }
  };

  const statusLabel = (m: Member) => {
    if (m.kind === 'member') return t('membersActive');
    return m.status === 'expired' ? t('membersExpired') : t('membersPending');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-800">{t('membersTitle')}</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={`${m.kind}-${m.id}`} className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {initialsOf(m)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 truncate">{nameOf(m)}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.role === 'primary'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.role === 'primary' ? t('membersPrimaryBadge') : t('membersCoParentBadge')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{m.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{statusLabel(m)}</div>
                </div>
                {m.kind === 'invitation' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => resendInvitation(m)}
                      className="text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      {t('membersResend')}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelInvitation(m)}
                      className="text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      {t('membersCancelInvite')}
                    </button>
                  </div>
                )}
                {m.kind === 'member' && m.role === 'co_parent' && (
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(m)}
                    className="text-xs font-medium text-red-500 hover:text-red-600 flex-shrink-0"
                  >
                    {t('membersRemove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasCoParentSlot && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-800">{t('inviteHeading')}</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">{t('inviteIntro')}</p>

          <div
            role="note"
            className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-4 mb-5"
          >
            <div className="flex items-center gap-2 font-semibold text-amber-800 mb-2">
              <AlertTriangle className="w-4 h-4" />
              {t('inviteWarningTitle')}
            </div>
            <p className="text-sm mb-2">{t('inviteWarningIntro')}</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>{t('inviteWarningItem1')}</li>
              <li>{t('inviteWarningItem2')}</li>
              <li>{t('inviteWarningItem3')}</li>
              <li>{t('inviteWarningItem4')}</li>
            </ul>
            <p className="text-sm mt-3">{t('inviteWarningOutro')}</p>
          </div>

          <form onSubmit={submitInvite} className="space-y-4">
            <Input
              label={t('inviteEmailLabel')}
              type="email"
              required
              placeholder={t('inviteEmailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError || undefined}
              icon={<Mail className="w-4 h-4" />}
            />

            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span>{t('inviteConsent')}</span>
            </label>

            {inviteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                {inviteSuccess}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={!consent || !email.trim() || sending} className="px-6">
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('inviteSending')}</>
                ) : (
                  t('inviteButton')
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {confirmingRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800">
              {t('removeMemberTitle', { name: nameOf(confirmingRemove) })}
            </h3>
            <p className="text-sm text-slate-600 mt-2">{t('removeMemberBody')}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmingRemove(null)}
                disabled={removing}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={removeMember}
                disabled={removing}
                className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('removeMemberConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
