'use client';

import { apiFetch } from '../../lib/apiFetch';
import React, { useMemo, useState } from 'react';
import { Link } from '../../lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { useTranslations } from 'next-intl';

export const BetaApplyForm = () => {
  const tBeta = useTranslations('Beta');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');

  const schema = useMemo(
    () =>
      z.object({
        first_name: z.string().min(1, tVal('firstNameRequired')).max(100, tVal('firstNameLength')),
        last_name: z.string().min(1, tVal('lastNameRequired')).max(100, tVal('lastNameLength')),
        email: z
          .string()
          .min(1, tVal('emailRequired'))
          .email(tVal('emailInvalid'))
          .max(255, tVal('emailLength')),
        reason: z
          .string()
          .min(50, tBeta('reasonTooShort'))
          .max(1000, tBeta('reasonTooLong')),
        website: z.string().max(200).optional(), // honeypot
      }),
    [tVal, tBeta],
  );

  type FormValues = z.infer<typeof schema>;

  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'received' | 'duplicate'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { website: '' },
  });

  const reason = watch('reason', '');
  const reasonChars = reason.length;

  const onSubmit = async (data: FormValues) => {
    setSubmitState('loading');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/v1/beta/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMsg(tBeta('rateLimited'));
        } else {
          setErrorMsg(tApi('somethingWentWrong'));
        }
        setSubmitState('idle');
        return;
      }
      const result = await res.json();
      setSubmitState(result.duplicate ? 'duplicate' : 'received');
    } catch (err) {
      setErrorMsg(tApi('somethingWentWrong'));
      setSubmitState('idle');
    }
  };

  if (submitState === 'received' || submitState === 'duplicate') {
    return (
      <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white mt-8 mb-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{tBeta('thanksTitle')}</h1>
          <p className="text-slate-600 mt-3 max-w-sm">
            {submitState === 'duplicate' ? tBeta('alreadyApplied') : tBeta('thanksBody')}
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center whitespace-nowrap mt-8 px-6 py-3 rounded-xl bg-white text-slate-700 border border-slate-200 font-semibold hover:border-primary hover:text-primary transition-all"
          >
            {tBeta('backHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white mt-8 mb-8">
      <div className="flex flex-col items-center mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          {tBeta('badge')}
        </span>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight text-center">
          {tBeta('title')}
        </h1>
        <p className="text-slate-500 mt-3 text-center font-medium">{tBeta('subtitle')}</p>
        <ul className="text-sm text-slate-600 mt-5 space-y-2 self-stretch">
          <li className="flex gap-2"><span className="text-primary">•</span>{tBeta('rule1')}</li>
          <li className="flex gap-2"><span className="text-primary">•</span>{tBeta('rule2')}</li>
          <li className="flex gap-2"><span className="text-primary">•</span>{tBeta('rule3')}</li>
        </ul>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            label={tBeta('firstNameLabel')}
            required
            autoComplete="given-name"
            {...register('first_name')}
            error={errors.first_name?.message}
            disabled={submitState === 'loading'}
          />
          <Input
            label={tBeta('lastNameLabel')}
            required
            autoComplete="family-name"
            {...register('last_name')}
            error={errors.last_name?.message}
            disabled={submitState === 'loading'}
          />
        </div>

        <Input
          label={tBeta('emailLabel')}
          required
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
          disabled={submitState === 'loading'}
        />

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            {tBeta('reasonLabel')}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            {...register('reason')}
            rows={5}
            disabled={submitState === 'loading'}
            placeholder={tBeta('reasonPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <div className="flex justify-between mt-1.5">
            {errors.reason ? (
              <span className="text-xs font-medium text-red-500">{errors.reason.message}</span>
            ) : (
              <span className="text-xs text-slate-500">{tBeta('reasonHint')}</span>
            )}
            <span className={`text-xs ${reasonChars < 50 || reasonChars > 1000 ? 'text-red-500' : 'text-slate-500'}`}>
              {reasonChars}/1000
            </span>
          </div>
        </div>

        {/* Honeypot — hidden from real users; bots fill it in and we silently drop them */}
        <div aria-hidden="true" className="hidden" style={{ position: 'absolute', left: '-9999px' }}>
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </label>
        </div>

        <p className="text-xs text-slate-500">{tBeta('consent')}</p>

        <Button
          type="submit"
          disabled={submitState === 'loading'}
          className="w-full mt-4 py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]"
        >
          {submitState === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            tBeta('submit')
          )}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-200 text-center">
        <Link href="/" className="text-sm text-slate-600 hover:text-primary transition-colors">
          {tBeta('backHome')}
        </Link>
      </div>
    </div>
  );
};
