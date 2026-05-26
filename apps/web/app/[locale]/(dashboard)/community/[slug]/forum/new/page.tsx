'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '../../../../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@oikos/ui';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link } from '../../../../../../../lib/navigation';
import { apiFetch } from '../../../../../../../lib/apiFetch';

export default function NewTopicPage() {
  const t = useTranslations('Community.forum');
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/communities/${encodeURIComponent(slug)}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/community/${slug}/forum/${data.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/community/${slug}/forum`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> {t('title')}
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">{t('newTopicTitle')}</h1>
        <Input
          label={t('topicTitle')}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('topicBody')} <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            maxLength={20000}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-slate-500 mt-1">
            Markdown supported: **bold**, *italic*, `code`, [links](url), - lists, &gt; quotes.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={submitting || !title.trim() || !body.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
