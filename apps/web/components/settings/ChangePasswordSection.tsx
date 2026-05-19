'use client';

import { apiFetch } from '../../lib/apiFetch';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';
import { CheckCircle2, Clock } from 'lucide-react';

interface Props {
  lastLoginAt: string | null;
}

export function ChangePasswordSection({ lastLoginAt }: Props) {
  const t = useTranslations('Settings');
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState('');

  const schema = z
    .object({
      current_password: z.string().min(1),
      new_password: z.string().min(10, 'Password must be at least 10 characters.'),
      confirm_password: z.string().min(1),
    })
    .refine((d) => d.new_password === d.confirm_password, {
      message: t('errorPasswordMismatch'),
      path: ['confirm_password'],
    });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: { current_password: string; new_password: string; confirm_password: string }) {
    setApiError('');
    setSaved(false);
    const res = await apiFetch('/api/v1/users/me/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail ?? '';
      if (typeof detail === 'string' && detail.toLowerCase().includes('incorrect')) {
        setApiError(t('errorIncorrectPassword'));
      } else {
        setApiError(t('errorGeneric'));
      }
      return;
    }
    reset();
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  const formattedLogin = lastLoginAt
    ? new Date(lastLoginAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('lastLoginNever');

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('securityTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('securitySubtitle')}</p>

      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">
        <Clock className="w-4 h-4 shrink-0" />
        <span>
          {t('lastLogin')}: <span className="text-slate-700 font-medium">{formattedLogin}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <Input
          label={t('currentPassword')}
          type="password"
          required
          {...register('current_password')}
          error={errors.current_password?.message}
        />
        <Input
          label={t('newPassword')}
          type="password"
          required
          {...register('new_password')}
          error={errors.new_password?.message}
        />
        <Input
          label={t('confirmPassword')}
          type="password"
          required
          {...register('confirm_password')}
          error={errors.confirm_password?.message}
        />

        {apiError && <p className="text-xs font-medium text-red-500">{apiError}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : t('changePassword')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              {t('passwordChanged')}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
