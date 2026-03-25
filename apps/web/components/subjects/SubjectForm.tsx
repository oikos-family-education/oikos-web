'use client';

import React, { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, X, ChevronUp, Minus, ChevronDown } from 'lucide-react';
import { categoryKey } from '../../lib/categoryLabel';
import { IconPicker } from './IconPicker';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';

const CATEGORIES = [
  'core_academic', 'language', 'scripture_theology', 'arts',
  'physical', 'practical_life', 'logic_rhetoric', 'technology',
  'elective', 'co_op', 'other',
];

const COLOR_PALETTE = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F97316', '#F59E0B', '#10B981', '#14B8A6',
  '#3B82F6', '#0EA5E9', '#64748B', '#22C55E',
];

const PRIORITY_OPTIONS = [
  { value: 1, key: 'priorityHigh', icon: ChevronUp, color: 'text-red-500' },
  { value: 2, key: 'priorityMedium', icon: Minus, color: 'text-amber-500' },
  { value: 3, key: 'priorityLow', icon: ChevronDown, color: 'text-slate-400' },
];

interface SubjectData {
  id?: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string;
  color: string;
  icon: string | null;
  min_age_years: number | null;
  max_age_years: number | null;
  priority?: number;
  default_session_duration_minutes: number;
  default_weekly_frequency: number;
  learning_objectives: string[];
  skills_targeted: string[];
  is_public: boolean;
}

interface SubjectFormProps {
  initialData?: SubjectData;
  isEditing?: boolean;
}

export function SubjectForm({ initialData, isEditing = false }: SubjectFormProps) {
  const t = useTranslations('Subjects');
  const tVal = useTranslations('Validation');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [objectives, setObjectives] = useState<string[]>(initialData?.learning_objectives || []);
  const [skills, setSkills] = useState<string[]>(initialData?.skills_targeted || []);
  const [selectedColor, setSelectedColor] = useState(initialData?.color || '#6366F1');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(initialData?.icon || null);
  const [priority, setPriority] = useState(initialData?.priority ?? 2);
  const [objectiveInput, setObjectiveInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  const schema = useMemo(() => z.object({
    name: z.string().min(1, 'Name is required').max(200),
    short_description: z.string().max(500).optional().or(z.literal('')),
    long_description: z.string().optional().or(z.literal('')),
    category: z.string().min(1, 'Category is required'),
    min_age_years: z.coerce.number().min(0).max(25).optional().or(z.literal('')),
    max_age_years: z.coerce.number().min(0).max(25).optional().or(z.literal('')),
    default_session_duration_minutes: z.coerce.number().min(5).max(480),
    default_weekly_frequency: z.coerce.number().min(1).max(7),
    is_public: z.boolean(),
  }), []);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      name: initialData?.name || '',
      short_description: initialData?.short_description || '',
      long_description: initialData?.long_description || '',
      category: initialData?.category || '',
      min_age_years: initialData?.min_age_years ?? '',
      max_age_years: initialData?.max_age_years ?? '',
      default_session_duration_minutes: initialData?.default_session_duration_minutes ?? 45,
      default_weekly_frequency: initialData?.default_weekly_frequency ?? 5,
      is_public: initialData?.is_public ?? false,
    },
  });

  function addObjective() {
    if (objectiveInput.trim()) {
      setObjectives([...objectives, objectiveInput.trim()]);
      setObjectiveInput('');
    }
  }

  function addSkill() {
    if (skillInput.trim()) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  }

  async function onSubmit(data: any) {
    setIsLoading(true);
    setError('');

    const body = {
      ...data,
      color: selectedColor,
      icon: selectedIcon,
      priority,
      min_age_years: data.min_age_years === '' ? null : Number(data.min_age_years),
      max_age_years: data.max_age_years === '' ? null : Number(data.max_age_years),
      short_description: data.short_description || null,
      long_description: data.long_description || null,
      learning_objectives: objectives,
      skills_targeted: skills,
    };

    const url = isEditing ? `/api/v1/subjects/${initialData?.id}` : '/api/v1/subjects';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push('/subjects');
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
          {/* Name */}
          <Input
            label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            required
            error={errors.name?.message as string}
            {...register('name')}
          />

          {/* Short Description */}
          <Input
            label={t('shortDescLabel')}
            placeholder={t('shortDescPlaceholder')}
            error={errors.short_description?.message as string}
            {...register('short_description')}
          />

          {/* Long Description */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('longDescLabel')}
            </label>
            <textarea
              placeholder={t('longDescPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              {...register('long_description')}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('categoryLabel')}<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              {...register('category')}
            >
              <option value="">{t('allCategories')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{t(categoryKey(cat))}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs font-medium text-red-500 mt-1">{errors.category.message as string}</p>
            )}
          </div>

          {/* Icon & Color */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('iconLabel')} & {t('colorLabel')}
            </label>
            <div className="flex items-start gap-4">
              {/* Icon picker */}
              <IconPicker value={selectedIcon} onChange={setSelectedIcon} color={selectedColor} />

              {/* Color palette + custom */}
              <div className="flex-1">
                <div className="flex gap-2 flex-wrap items-center">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {/* Custom color picker */}
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-xs text-slate-500">{t('customColorLabel')}:</label>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('priorityLabel')}
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      priority === opt.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${priority === opt.value ? 'text-primary' : opt.color}`} />
                    {t(opt.key)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Age range */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('minAgeLabel')}
              type="number"
              min={0}
              max={25}
              error={errors.min_age_years?.message as string}
              {...register('min_age_years')}
            />
            <Input
              label={t('maxAgeLabel')}
              type="number"
              min={0}
              max={25}
              error={errors.max_age_years?.message as string}
              {...register('max_age_years')}
            />
          </div>

          {/* Session defaults */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('sessionDurationLabel')}
              type="number"
              min={5}
              max={480}
              step={5}
              required
              error={errors.default_session_duration_minutes?.message as string}
              {...register('default_session_duration_minutes')}
            />
            <Input
              label={t('weeklyFrequencyLabel')}
              type="number"
              min={1}
              max={7}
              required
              error={errors.default_weekly_frequency?.message as string}
              {...register('default_weekly_frequency')}
            />
          </div>

          {/* Learning Objectives */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('learningObjectivesLabel')}
            </label>
            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={objectiveInput}
                onChange={(e) => setObjectiveInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                placeholder={t('learningObjectivesPlaceholder')}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <p className="text-xs text-slate-400 mb-2">{t('tagHint')}</p>
            <div className="flex flex-wrap gap-2">
              {objectives.map((obj, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {obj}
                  <button type="button" onClick={() => setObjectives(objectives.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Skills Targeted */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              {t('skillsLabel')}
            </label>
            <div className="flex gap-2 mb-1">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder={t('skillsPlaceholder')}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <p className="text-xs text-slate-400 mb-2">{t('tagHint')}</p>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                  {skill}
                  <button type="button" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_public"
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                {...register('is_public')}
              />
              <label htmlFor="is_public" className="text-sm text-slate-600">
                {t('visibilityLabel')}
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-7">{t('visibilityHint')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/subjects')}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('saveSubject')}
          </Button>
        </div>
      </form>
    </div>
  );
}
