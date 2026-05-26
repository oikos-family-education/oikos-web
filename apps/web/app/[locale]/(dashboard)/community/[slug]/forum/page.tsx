'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, ArrowLeft, Pin, Lock, Plus } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Link } from '../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../lib/apiFetch';
import { CommunityTabs } from '../../../../../../components/community/CommunityTabs';
import type { CommunityDetail, TopicCard } from '../../../../../../components/community/types';

export default function ForumPage() {
  const t = useTranslations('Community.forum');
  const params = useParams();
  const slug = params.slug as string;
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [topics, setTopics] = useState<TopicCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, tp] = await Promise.all([
        apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)),
        apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics`).then((r) =>
          r.ok ? r.json() : { items: [] },
        ),
      ]);
      setCommunity(c);
      setTopics(tp.items);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!community) {
    return (
      <p className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        Not available.
      </p>
    );
  }

  const canSettings = community.viewer_role === 'admin' || community.viewer_role === 'co_admin';

  return (
    <div className="max-w-5xl">
      <Link href={`/community/${slug}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {community.name}
      </Link>

      <CommunityTabs slug={slug} canSettings={canSettings} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{t('title')}</h2>
        <Link href={`/community/${slug}/forum/new`}>
          <Button>
            <Plus className="w-4 h-4 mr-1" /> {t('newTopic')}
          </Button>
        </Link>
      </div>

      {topics.length === 0 ? (
        <p className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          {t('emptyTopics')}
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/community/${slug}/forum/${topic.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {topic.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                  {topic.is_locked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-sm font-semibold text-slate-800 truncate">{topic.title}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('byAuthor', { family: topic.author_family_name })}
                </p>
              </div>
              <div className="text-xs text-slate-500 shrink-0">
                {topic.reply_count > 0
                  ? `${topic.reply_count} ${topic.reply_count === 1 ? 'reply' : 'replies'}`
                  : 'No replies'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
