'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { useTranslations } from 'next-intl';

export const LoginForm = () => {
  const router = useRouter();
  const tAuth = useTranslations('Auth');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');

  const loginSchema = useMemo(() => z.object({
    email: z.string().min(1, tVal('emailRequired')).email(tVal('emailInvalid')).max(255, tVal('emailLength')),
    password: z.string().min(1, tVal('passwordRequired')).max(128, tVal('passwordLength')),
  }), [tVal]);

  type LoginFormValues = z.infer<typeof loginSchema>;

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 423) {
          setErrorMsg(tApi('accountLocked'));
        } else if (res.status === 429) {
          setErrorMsg(tApi('tooManyAttempts'));
        } else {
          setErrorMsg(result.detail?.detail || result.detail || tApi('invalidCredentials'));
        }
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setErrorMsg(tApi('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary/30 rotate-3">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight text-center">{tAuth('welcomeBack')}</h1>
        <p className="text-slate-500 mt-2 text-center font-medium">{tAuth('signInToOikos')}</p>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label={tAuth('emailLabel')}
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
          disabled={isLoading}
        />
        
        <div className="space-y-1">
          <Input
            label={tAuth('passwordLabel')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
            disabled={isLoading}
            icon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="focus:outline-none hover:text-primary transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
          />
          <div className="flex justify-end pt-1">
            <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
              {tAuth('forgotPassword')}
            </Link>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full mt-2 py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : tAuth('signInButton')}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <p className="text-center text-slate-600 font-medium">
          {tAuth('dontHaveAccount')}{' '}
          <Link href="/register" className="text-primary font-bold hover:text-primary-hover hover:underline transition-all">
            {tAuth('createFreeAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
};
