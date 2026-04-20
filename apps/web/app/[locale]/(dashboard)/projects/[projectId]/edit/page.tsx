'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../../../lib/navigation';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Button } from '@oikos/ui';

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

interface ProjectChild {
  project_id: string;
  child_id: string;
}

interface ProjectSubject {
  project_id: string;
  subject_id: string;
  is_primary: boolean;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  purpose: string | null;
  due_date: string | null;
  status: string;
  children: ProjectChild[];
  subjects: ProjectSubject[];
}

export default function EditProjectPage() {
  const t = useTranslations('Projects');
  const tVal = useTranslations('Validation');
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, tVal('firstNameRequired')).max(200),
        description: z.string().optional(),
        purpose: z.string().optional(),
        due_date: z.string().optional(),
        child_ids: z.array(z.string()).min(1),
        subject_ids: z.array(z.string()).max(2),
      }),
    [tVal]
  );

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
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
    },
  });

  useEffect(() => {
    async function loadAll() {
      const [projRes, childRes, subjRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}`, { credentials: 'include' }),
        fetch('/api/v1/families/me/children', { credentials: 'include' }),
        fetch('/api/v1/subjects?source=mine', { credentials: 'include' }),
      ]);

      if (childRes.ok) setChildren(await childRes.json());
      if (subjRes.ok) setSubjects(await subjRes.json());

      if (projRes.ok) {
        const p: Project = await projRes.json();
        setProject(p);
        reset({
          title: p.title,
          description: p.description || '',
          purpose: p.purpose || '',
          due_date: p.due_date || '',
          child_ids: p.children.map((c) => c.child_id),
          subject_ids: p.subjects.map((s) => s.subject_id),
        });
      }
      setIsLoading(false);
    }
    loadAll();
  }, [projectId, reset]);

  async function onSubmit(data: FormData) {
    setIsSaving(true);
    setError('');

    const body: Record<string, unknown> = {
      title: data.title,
      description: data.description || null,
      purpose: data.purpose || null,
      due_date: data.due_date || null,
      child_ids: data.child_ids,
      subject_ids: data.subject_ids,
    };

    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push(`/projects/${projectId}`);
    } else {
      const err = await res.json().catch(() => null);
      setError(typeof err?.detail === 'string' ? err.detail : 'Something went wrong.');
    }
    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-5xl">
        <p className="text-slate-500">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {project.title}
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('editTitle')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
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
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
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
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t('dueDateLabel')}</label>
            <input
              type="date"
              {...register('due_date')}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t('descriptionLabel')}</label>
            <textarea
              {...register('description')}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">{t('purposeLabel')}</label>
            <textarea
              {...register('purpose')}
              placeholder={t('purposePlaceholder')}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          To add, rename, or remove milestones, use the Milestones tab on the project page.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            {t('cancel')}
          </button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('saveProject')}
          </Button>
        </div>
      </form>
    </div>
  );
}
