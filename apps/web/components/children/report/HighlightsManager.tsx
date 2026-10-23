'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@oikos/ui';
import { apiFetch } from '../../../lib/apiFetch';
import { formatDate } from '../../../lib/formatDate';
import { HIGHLIGHT_ICONS } from './ChildReportSheet';
import { HIGHLIGHT_CATEGORIES, Highlight, HighlightCategory, parseLocalDate } from './types';

interface HighlightsManagerProps {
  childId: string;
  childName: string;
  fromDate: string;
  toDate: string;
  dateFormat: string;
  onChanged: () => void;
}

interface FormValues {
  category: HighlightCategory;
  title: string;
  occurred_on?: string;
  description?: string;
}

// Resource types offered as title suggestions per highlight category
const SUGGESTION_TYPES: Partial<Record<HighlightCategory, string>> = {
  book: 'book',
  documentary: 'documentary',
};

export function HighlightsManager({ childId, childName, fromDate, toDate, dateFormat, onChanged }: HighlightsManagerProps) {
  const t = useTranslations('ChildReport');
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Highlight | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resources, setResources] = useState<{ title: string; type: string }[]>([]);

  const schema = useMemo(() => z.object({
    category: z.enum(['social', 'book', 'documentary', 'outdoor', 'other']),
    title: z.string().trim().min(1, t('titleRequired')).max(200),
    occurred_on: z.string().optional(),
    description: z.string().max(5000).optional(),
  }), [t]);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { category: 'book', title: '', occurred_on: '', description: '' },
  });
  const category = watch('category');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(
      `/api/v1/children/${childId}/highlights?from=${fromDate}&to=${toDate}`,
      { credentials: 'include' },
    );
    if (res.ok) setHighlights(await res.json());
    setLoading(false);
  }, [childId, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch('/api/v1/resources', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { title: string; type: string }[]) => setResources(rows))
      .catch(() => {});
  }, []);

  const suggestions = SUGGESTION_TYPES[category]
    ? resources.filter((r) => r.type === SUGGESTION_TYPES[category]).map((r) => r.title)
    : [];

  function openNew(cat: HighlightCategory = 'book') {
    setEditing(null);
    setError('');
    reset({ category: cat, title: '', occurred_on: '', description: '' });
    setFormOpen(true);
  }

  function openEdit(h: Highlight) {
    setEditing(h);
    setError('');
    reset({ category: h.category, title: h.title, occurred_on: h.occurred_on ?? '', description: h.description ?? '' });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setError('');
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setError('');
    const res = await apiFetch(
      editing
        ? `/api/v1/children/${childId}/highlights/${editing.id}`
        : `/api/v1/children/${childId}/highlights`,
      {
        method: editing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          occurred_on: values.occurred_on || null,
          description: values.description?.trim() || null,
        }),
      },
    );
    setSaving(false);
    if (!res.ok) {
      setError(t('saveError'));
      return;
    }
    closeForm();
    await load();
    onChanged();
  }

  async function remove(h: Highlight) {
    const res = await apiFetch(`/api/v1/children/${childId}/highlights/${h.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      onChanged();
    }
  }

  const fmt = (d: string) => formatDate(parseLocalDate(d), dateFormat);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="text-lg font-semibold text-slate-800">{t('highlightsTitle')}</h2>
        {!formOpen && (
          <Button type="button" onClick={() => openNew()} className="text-sm !px-3 !py-1.5">
            <Plus className="w-4 h-4 mr-1" />
            {t('addHighlight')}
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-5">{t('highlightsSubtitle', { name: childName })}</p>

      {formOpen && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="highlight-category" className="text-sm font-semibold text-slate-700">
                {t('categoryLabel')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                id="highlight-category"
                {...register('category')}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {HIGHLIGHT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`category_${c}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <Input
                id="highlight-date"
                type="date"
                label={t('dateLabel')}
                error={errors.occurred_on?.message}
                {...register('occurred_on')}
              />
              <p className="text-xs text-slate-500 mt-1">{t('dateHint')}</p>
            </div>
          </div>
          <Input
            id="highlight-title"
            label={t('titleLabel')}
            required
            placeholder={t(`titlePlaceholder_${category}`)}
            list={suggestions.length > 0 ? 'highlight-suggestions' : undefined}
            error={errors.title?.message}
            {...register('title')}
          />
          {suggestions.length > 0 && (
            <datalist id="highlight-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="highlight-description" className="text-sm font-semibold text-slate-700">
              {t('descriptionLabel')}
            </label>
            <textarea
              id="highlight-description"
              rows={3}
              placeholder={t('descriptionPlaceholder')}
              {...register('description')}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              {t('cancel')}
            </button>
            <Button type="submit" disabled={saving} className="px-5">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : editing ? t('saveHighlight') : t('addHighlight')}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : highlights.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {HIGHLIGHT_CATEGORIES.map((c) => {
            const Icon = HIGHLIGHT_ICONS[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => openNew(c)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-primary hover:text-primary transition-colors text-xs font-medium text-center"
              >
                <Icon className="w-5 h-5" />
                {t(`category_${c}`)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {HIGHLIGHT_CATEGORIES.map((c) => {
            const items = highlights.filter((h) => h.category === c);
            if (items.length === 0) return null;
            const Icon = HIGHLIGHT_ICONS[c];
            return (
              <div key={c}>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {t(`category_${c}`)}
                  <span className="text-slate-400 font-normal">({items.length})</span>
                </h3>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {items.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 px-3 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-sm font-semibold text-slate-800">{h.title}</p>
                          {h.occurred_on && <p className="text-xs text-slate-500 whitespace-nowrap">{fmt(h.occurred_on)}</p>}
                        </div>
                        {h.description && (
                          <p className="text-sm text-slate-600 mt-1.5 pl-4 leading-relaxed whitespace-pre-line">{h.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50"
                        aria-label={t('editHighlight', { title: h.title })}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(h)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                        aria-label={t('deleteHighlight', { title: h.title })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
