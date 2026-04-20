'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../../lib/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';

interface Child {
  id: string;
  first_name: string;
  nickname: string | null;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function NewProjectPage() {
  const t = useTranslations('Projects');
  const tVal = useTranslations('Validation');
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const [childRes, subjRes] = await Promise.all([
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
      ]);
      if (childRes.ok) setChildren(await childRes.json());
      if (subjRes.ok) setSubjects(await subjRes.json());
    }
    loadData();
  }, []);

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, tVal('firstNameRequired')).max(200),
        description: z.string().optional(),
        purpose: z.string().optional(),
        due_date: z.string().optional(),
        child_ids: z.array(z.string()).min(1),
        subject_ids: z.array(z.string()).max(2),
        milestones: z.array(
          z.object({
            title: z.string().min(1),
            description: z.string().optional(),
          })
        ),
      }),
    [tVal]
  );

  type FormData = z.infer<typeof schema>;

  const defaultMilestones = [
    { title: 'Research & Gather', description: '' },
    { title: 'Plan & Outline', description: '' },
    { title: 'Create & Build', description: '' },
    { title: 'Review & Refine', description: '' },
    { title: 'Present or Deliver', description: '' },
    { title: 'Reflect', description: '' },
  ];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      purpose: '',
      due_date: '',
      child_ids: [],
      subject_ids: [],
      milestones: defaultMilestones,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'milestones',
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    setError('');

    const body = {
      title: data.title,
      description: data.description || null,
      purpose: data.purpose || null,
      due_date: data.due_date || null,
      status: 'draft',
      child_ids: data.child_ids,
      subject_ids: data.subject_ids,
      milestones: data.milestones.map((m, i) => ({
        title: m.title,
        description: m.description || null,
        sort_order: i,
      })),
    };

    const res = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } else {
      const err = await res.json().catch(() => null);
      setError(err?.detail || 'Something went wrong.');
    }
    setIsLoading(false);
  }

  return (
    <div className="max-w-5xl">
      <button
        onClick={() => router.push('/projects')}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('title')}
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('createTitle')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          {/* Title */}
          <Input
            label={t('titleLabel')}
            placeholder={t('titlePlaceholder')}
            required
            error={errors.title?.message}
            {...register('title')}
          />

          {/* Assign Children */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('assignChildrenLabel')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">{t('assignChildrenHelp')}</p>
            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <label
                  key={child.id}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:border-primary/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
                >
                  <input
                    type="checkbox"
                    value={child.id}
                    {...register('child_ids')}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700">{child.nickname || child.first_name}</span>
                </label>
              ))}
            </div>
            {errors.child_ids && (
              <p className="text-xs font-medium text-red-500 mt-1">{errors.child_ids.message}</p>
            )}
          </div>

          {/* Link Subjects */}
          {subjects.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                {t('linkSubjectsLabel')}
              </label>
              <p className="text-xs text-slate-500 mb-2">{t('linkSubjectsHelp')}</p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => (
                  <label
                    key={subject.id}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:border-primary/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
                  >
                    <input
                      type="checkbox"
                      value={subject.id}
                      {...register('subject_ids')}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className="text-sm text-slate-700">{subject.name}</span>
                  </label>
                ))}
              </div>
              {errors.subject_ids && (
                <p className="text-xs font-medium text-red-500 mt-1">{errors.subject_ids.message}</p>
              )}
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('dueDateLabel')}
            </label>
            <input
              type="date"
              {...register('due_date')}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('descriptionLabel')}
            </label>
            <textarea
              {...register('description')}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('purposeLabel')}
            </label>
            <textarea
              {...register('purpose')}
              placeholder={t('purposePlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <label className="text-sm font-semibold text-slate-700 block mb-1">
            {t('milestonesLabel')}
          </label>
          <p className="text-xs text-slate-500 mb-4">{t('milestonesHelp')}</p>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-xs text-slate-400 w-5">{index + 1}</span>
                <input
                  {...register(`milestones.${index}.title`)}
                  placeholder={`Milestone ${index + 1}`}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => append({ title: '', description: '' })}
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover font-medium mt-3"
          >
            <Plus className="w-4 h-4" />
            {t('addMilestone')}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/projects')}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {t('cancel')}
          </button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('saveProject')}
          </Button>
        </div>
      </form>
    </div>
  );
}
