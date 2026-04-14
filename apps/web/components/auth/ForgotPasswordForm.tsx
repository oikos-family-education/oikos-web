'use client';

import React, { useState, useMemo } from 'react';
import { Link } from '../../lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, MailCheck } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { useTranslations } from 'next-intl';

export const ForgotPasswordForm = () => {
  const tAuth = useTranslations('Auth');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');

  const forgotPasswordSchema = useMemo(() => z.object({
    email: z.string().min(1, tVal('emailRequired')).email(tVal('emailInvalid')),
  }), [tVal]);

  type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

  const [isSuccess, setIsSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setErrorMsg(tApi('somethingWentWrong'));
      } else {
        setSuccessEmail(data.email);
        setIsSuccess(true);
      }
    } catch (err) {
      setErrorMsg(tApi('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <MailCheck className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">{tAuth('checkYourEmail')}</h2>
        <p className="text-slate-600 leading-relaxed mb-8">
          {tAuth.rich('resetEmailSent', {
            email: successEmail,
            bold: (chunks) => <span className="font-semibold text-slate-900">{chunks}</span>
          })}
        </p>
        <Link href="/login" className="text-primary font-semibold hover:text-primary-hover hover:underline transition-all">
          {tAuth('backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white">
      <Link href="/login" className="text-slate-400 hover:text-slate-600 font-medium text-sm flex items-center gap-1 transition-colors mb-6">
        {tAuth('backToSignIn')}
      </Link>
      <div className="flex flex-col mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{tAuth('resetYourPassword')}</h1>
        <p className="text-slate-500 mt-2 font-medium leading-relaxed">{tAuth('enterEmailForReset')}</p>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Input
          label={tAuth('emailLabel')}
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
          disabled={isLoading}
        />

        <Button type="submit" disabled={isLoading} className="w-full py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : tAuth('sendResetLink')}
        </Button>
      </form>
    </div>
  );
};
