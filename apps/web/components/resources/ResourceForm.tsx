'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '@oikos/ui';
import { Resource } from './ResourceCard';

const RESOURCE_TYPES = [
  'book', 'article', 'video', 'course', 'podcast',
  'documentary', 'printable', 'website', 'curriculum', 'other',
] as const;

interface Subject {
  id: string;
  name: string;
}

interface ResourceFormProps {
  initialData?: Resource;
  isEditing?: boolean;
}

export function ResourceForm({ initialData, isEditing = false }: ResourceFormProps) {
  const t = useTranslations('Resources');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(
    initialData?.subjects.map((s) => s.subject_id) || []
  );

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, 'Title is required').max(255),
        type: z.string().min(1, 'Type is required'),
        author: z.string().max(255).optional().or(z.literal('')),
        description: z.string().optional().or(z.literal('')),
        url: z.string().optional().or(z.literal('')),
      }),
    []
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      title: initialData?.title || '',
      type: initialData?.type || '',
      author: initialData?.author || '',
      description: initialData?.description || '',
      url: initialData?.url || '',
    },
  });

  useEffect(() => {
    async function loadSubjects() {
      const res = await fetch('/api/v1/subjects?source=mine', { credentials: 'include' });
      if (res.ok) {
        setSubjects(await res.json());
      }
    }
    loadSubjects();
  }, []);

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function onSubmit(data: any) {
    setIsLoading(true);
    setError('');

    const body = {
      ...data,
      author: data.author || null,
      description: data.description || null,
      url: data.url || null,
      subject_ids: selectedSubjectIds,
    };

    const url = isEditing
      ? `/api/v1/resources/${initialData?.id}`
      : '/api/v1/resources';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const resource = await res.json();
      router.push(`/resources/${resource.id}`);
    } else {
      const err = await res.json().catch(() => null);
      setError(err?.detail || 'Something went wrong.');
    }
    setIsLoading(false);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        {isEditing ? t('editTitle') : t('createTitle')}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <Input
            label={t('titleLabel')}
            placeholder={t('titlePlaceholder')}
            required
            error={errors.title?.message as string}
            {...register('title')}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('typeLabel')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                errors.type ? 'border-red-500' : 'border-slate-200'
              }`}
              {...register('type')}
            >
              <option value="">{t('typePlaceholder')}</option>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type${type.charAt(0).toUpperCase() + type.slice(1)}` as any)}
                </option>
              ))}
            </select>
            {errors.type?.message && (
              <span className="text-xs font-medium text-red-500 mt-0.5">{errors.type.message as string}</span>
            )}
          </div>

          <Input
            label={t('authorLabel')}
            placeholder={t('authorPlaceholder')}
            error={errors.author?.message as string}
            {...register('author')}
          />

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('descriptionLabel')}
            </label>
            <textarea
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              {...register('description')}
            />
          </div>

          <Input
            label={t('urlLabel')}
            placeholder={t('urlPlaceholder')}
            error={errors.url?.message as string}
            {...register('url')}
          />
        </div>

        {subjects.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <label className="text-sm font-semibold text-slate-700 block mb-3">
              {t('subjectsLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const selected = selectedSubjectIds.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/resources')}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {t('cancel')}
          </button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('saveResource')}
          </Button>
        </div>
      </form>
    </div>
  );
}
