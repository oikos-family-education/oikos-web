'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, Pin, Lock, Flag, Trash2 } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link } from '../../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../../lib/apiFetch';
import { MarkdownLite } from '../../../../../../../components/community/MarkdownLite';
import { MarkdownToolbar } from '../../../../../../../components/community/MarkdownToolbar';
import { CopyLinkButton } from '../../../../../../../components/community/CopyLinkButton';
import { ReportDialog } from '../../../../../../../components/community/ReportDialog';
import type { CommunityDetail, TopicDetail } from '../../../../../../../components/community/types';

export default function TopicDetailPage() {
  const t = useTranslations('Community.forum');
  const params = useParams();
  const slug = params.slug as string;
  const topicId = params.topicId as string;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [report, setReport] = useState<{ type: 'topic' | 'reply'; id: string } | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Permalink hash highlight (v2 spec §4.2): when the URL has #reply-<id>,
  // briefly highlight that reply and scroll into view.
  useEffect(() => {
    if (typeof window === 'undefined' || !topic) return;
    const hash = window.location.hash;
    if (!hash.startsWith('#reply-')) return;
    const id = hash.replace('#reply-', '');
    setHighlightedReplyId(id);
    const el = document.getElementById(`reply-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightedReplyId(null), 2000);
    return () => clearTimeout(t);
  }, [topic]);

  async function reload() {
    const [c, tp] = await Promise.all([
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics/${topicId}`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ]);
    setCommunity(c);
    setTopic(tp);
  }

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [slug, topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reply() {
    if (!replyBody.trim()) return;
    setReplying(true);
    try {
      const res = await apiFetch(
        `/api/v1/communities/${encodeURIComponent(slug)}/topics/${topicId}/replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: replyBody }),
        },
      );
      if (res.ok) {
        setReplyBody('');
        await reload();
      }
    } finally {
      setReplying(false);
    }
  }

  async function pinToggle() {
    if (!topic) return;
    await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics/${topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !topic.is_pinned }),
    });
    await reload();
  }

  async function lockToggle() {
    if (!topic) return;
    await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics/${topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_locked: !topic.is_locked }),
    });
    await reload();
  }

  async function deleteTopic() {
    if (!confirm('Delete this topic?')) return;
    await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics/${topicId}`, {
      method: 'DELETE',
    });
    await reload();
  }

  async function deleteReply(id: string) {
    if (!confirm('Delete this reply?')) return;
    await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/replies/${id}`, {
      method: 'DELETE',
    });
    await reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!community || !topic) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Topic not found.
      </p>
    );
  }

  const isAdmin = community.viewer_role === 'admin' || community.viewer_role === 'co_admin';

  return (
    <div className="max-w-3xl">
      <Link href={`/community/${slug}/forum`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
      </Link>

      <article className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <header className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {topic.is_pinned && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <Pin className="w-3 h-3" /> {t('pinned')}
              </span>
            )}
            {topic.is_locked && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                <Lock className="w-3 h-3" /> {t('locked')}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{topic.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('byAuthor', { family: topic.author_family_name })}
            {topic.edited_at && <span className="ml-2">{t('edited')}</span>}
          </p>
        </header>
        <MarkdownLite source={topic.body} />

        <footer className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100 text-xs">
          {isAdmin && (
            <>
              <button onClick={pinToggle} className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">
                {topic.is_pinned ? t('unpin') : t('pin')}
              </button>
              <button onClick={lockToggle} className="px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">
                {topic.is_locked ? t('unlock') : t('lock')}
              </button>
              <button
                onClick={deleteTopic}
                className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" /> {t('delete')}
              </button>
            </>
          )}
          <CopyLinkButton url={`/community/${slug}/forum/${topic.id}`} />
          <button
            onClick={() => setReport({ type: 'topic', id: topic.id })}
            className="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 ml-auto"
          >
            <Flag className="w-3 h-3" /> {t('report')}
          </button>
        </footer>
      </article>

      <section className="space-y-3 mb-6">
        {topic.replies.map((r) => (
          <div
            key={r.id}
            id={`reply-${r.id}`}
            className={`bg-white rounded-xl border p-5 transition-colors ${
              highlightedReplyId === r.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
            }`}
          >
            <header className="mb-2">
              <p className="text-xs text-slate-500">
                {t('byAuthor', { family: r.author_family_name })}
                {r.edited_at && <span className="ml-2">{t('edited')}</span>}
              </p>
            </header>
            <MarkdownLite source={r.body} />
            <footer className="flex gap-2 pt-3 mt-3 border-t border-slate-100 text-xs">
              <CopyLinkButton url={`/community/${slug}/forum/${topic.id}#reply-${r.id}`} />
              {isAdmin && !r.deleted_at && (
                <button
                  onClick={() => deleteReply(r.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" /> {t('delete')}
                </button>
              )}
              <button
                onClick={() => setReport({ type: 'reply', id: r.id })}
                className="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 ml-auto"
              >
                <Flag className="w-3 h-3" /> {t('report')}
              </button>
            </footer>
          </div>
        ))}
      </section>

      {topic.is_locked ? (
        <p className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 text-center">
          {t('lockedNotice')}
        </p>
      ) : (
        <div className="bg-white rounded-b-xl border border-slate-200 p-0">
          <MarkdownToolbar value={replyBody} onChange={setReplyBody} textareaRef={replyRef} />
          <div className="p-5 pt-3">
          <textarea
            ref={replyRef}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={4}
            maxLength={20000}
            placeholder={t('replyPlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex justify-end mt-2">
            <Button onClick={reply} disabled={replying || !replyBody.trim()}>
              {replying ? t('replying') : t('reply')}
            </Button>
          </div>
          </div>
        </div>
      )}

      {report && (
        <ReportDialog
          open={!!report}
          onClose={() => setReport(null)}
          slug={slug}
          targetType={report.type}
          targetId={report.id}
        />
      )}
    </div>
  );
}
