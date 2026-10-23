'use client';

import { apiFetch } from '../../lib/apiFetch';
import React, { useState, useMemo } from 'react';
import { useRouter } from '../../lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { useTranslations } from 'next-intl';
import { locales } from '../../i18n';

type AppLocale = (typeof locales)[number];
function asAppLocale(value: unknown): AppLocale | undefined {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : undefined;
}

interface LocalResetPasswordFormProps {
  initialEmail?: string;
  title?: string;
}

/**
 * Desktop-mode replacement for the email-based forgot-password flow: there is
 * no email on a local install, so the parent types their email and a new
 * password and is logged straight in.
 */
export const LocalResetPasswordForm = ({ initialEmail, title }: LocalResetPasswordFormProps) => {
  const router = useRouter();
  const tAuth = useTranslations('Auth');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');
  const tDesktop = useTranslations('Desktop');

  const schema = useMemo(() => z.object({
    email: z.string().min(1, tVal('emailRequired')).max(255, tVal('emailLength')).email(tVal('emailInvalid')),
    new_password: z.string()
      .min(10, tVal('passwordMin'))
      .max(128, tVal('passwordLength')),
    confirm_password: z.string().min(1, tVal('confirmPasswordRequired')),
  }).refine((data) => data.new_password === data.confirm_password, {
    message: tVal('passwordsDoNotMatch'),
    path: ['confirm_password'],
  }), [tVal]);

  type FormValues = z.infer<typeof schema>;

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: initialEmail ?? '' },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/v1/auth/local-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 404) {
          setErrorMsg(tDesktop('accountNotFound'));
        } else if (res.status === 429) {
          setErrorMsg(tApi('tooManyAttempts'));
        } else {
          setErrorMsg(tApi('somethingWentWrong'));
        }
        return;
      }
      const result = await res.json();
      const targetLocale = asAppLocale(result.user?.locale);
      if (targetLocale) {
        router.push('/dashboard', { locale: targetLocale });
      } else {
        router.push('/dashboard');
      }
    } catch {
      setErrorMsg(tApi('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white">
      <div className="flex flex-col mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
          {title ?? tDesktop('setPasswordTitle')}
        </h1>
        <p className="text-slate-500 mt-2 font-medium leading-relaxed">{tDesktop('setPasswordSubtitle')}</p>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Input
          label={tAuth('emailLabel')}
          type="email"
          autoComplete="email"
          required
          {...register('email')}
          error={errors.email?.message}
          disabled={isLoading}
        />

        <Input
          label={tAuth('newPasswordLabel')}
          type="password"
          autoComplete="new-password"
          required
          {...register('new_password')}
          error={errors.new_password?.message}
          disabled={isLoading}
        />

        <Input
          label={tAuth('confirmNewPasswordLabel')}
          type="password"
          autoComplete="new-password"
          required
          {...register('confirm_password')}
          error={errors.confirm_password?.message}
          disabled={isLoading}
        />

        <Button type="submit" disabled={isLoading} className="w-full py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : tDesktop('setPasswordButton')}
        </Button>
      </form>
    </div>
  );
};
