'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '../../lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { Link } from '../../lib/navigation';
import { useTranslations } from 'next-intl';

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Read token from URL hash fragment (not sent to servers, unlike query params)
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      setToken(hash.slice('#token='.length));
      // Clean the hash from the URL to avoid leaking in browser history
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      // Fallback: support legacy query param links
      setToken(searchParams.get('token'));
    }
  }, [searchParams]);
  
  const tAuth = useTranslations('Auth');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');
  const tStr = useTranslations('PasswordStrength');

  const resetSchema = useMemo(() => z.object({
    new_password: z.string()
      .min(10, tVal('passwordMin'))
      .max(128, tVal('passwordLength'))
      .regex(/[A-Z]/, tVal('passwordUppercase'))
      .regex(/[a-z]/, tVal('passwordLowercase'))
      .regex(/[0-9]/, tVal('passwordNumber'))
      .regex(/[!@#$%^&*()_+\-=\[\]{}]/, tVal('passwordSpecial')),
    confirm_password: z.string().min(1, tVal('confirmPasswordRequired')),
  }).refine((data) => data.new_password === data.confirm_password, {
    message: tVal('passwordsDoNotMatch'),
    path: ["confirm_password"],
  }), [tVal]);

  type ResetFormValues = z.infer<typeof resetSchema>;

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
  });

  const pw = watch('new_password', '');
  const [strength, setStrength] = useState({ label: '', color: 'bg-slate-200', textClass: 'text-slate-500' });

  useEffect(() => {
    if (!pw) {
      setStrength({ label: '', color: 'bg-slate-200', textClass: 'text-slate-500' });
      return;
    }
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    const hasSpec = /[!@#$%^&*()_+\-=\[\]{}]/.test(pw);
    const rulesMet = [hasUpper, hasLower, hasNum, hasSpec].filter(Boolean).length;
    
    if (pw.length < 10 || rulesMet < 4) {
      setStrength({ label: tStr('weak'), color: 'bg-red-400', textClass: 'text-red-500 font-medium' });
    } else if (pw.length < 12) {
      setStrength({ label: tStr('fair'), color: 'bg-amber-400', textClass: 'text-amber-500 font-medium' });
    } else if (pw.length < 16) {
      setStrength({ label: tStr('strong'), color: 'bg-green-500', textClass: 'text-green-600 font-semibold' });
    } else {
      setStrength({ label: tStr('veryStrong'), color: 'bg-green-600', textClass: 'text-green-700 font-extrabold' });
    }
  }, [pw, tStr]);

  const onSubmit = async (data: ResetFormValues) => {
    if (!token) {
      setErrorMsg(tApi('noToken'));
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, ...data }),
      });
      const result = await res.json();
      if (!res.ok) {
        setErrorMsg(result.detail?.detail || tApi('invalidToken'));
      } else {
        setSuccessMsg(tAuth('passwordResetSuccess'));
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setErrorMsg(tApi('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white">
      <div className="flex flex-col mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{tAuth('chooseNewPassword')}</h1>
        <p className="text-slate-500 mt-2 font-medium leading-relaxed">{tAuth('makeSureLength')}</p>
      </div>

      {successMsg ? (
        <Alert type="success" message={successMsg} />
      ) : (
        <>
          {errorMsg && (
            <div className="mb-6">
              <Alert type="error" message={errorMsg} />
              {errorMsg.includes('invalid') && (
                <div className="text-center mt-2">
                  <Link href="/forgot-password" className="text-primary font-semibold hover:underline">
                    {tAuth('requestNewLink')}
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div>
              <Input
                label={tAuth('newPasswordLabel')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('new_password')}
                error={errors.new_password?.message}
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
              
              {pw.length > 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex-1 flex gap-1 h-1.5 mr-3">
                    <div className={`h-full flex-1 rounded-full ${strength.label === tStr('weak') ? 'bg-red-400' : strength.label === tStr('fair') ? 'bg-amber-400' : strength.label.includes(tStr('strong')) ? 'bg-green-500' : 'bg-slate-200'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strength.label === tStr('fair') ? 'bg-amber-400' : strength.label.includes(tStr('strong')) ? 'bg-green-500' : 'bg-slate-200'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strength.label.includes(tStr('strong')) ? 'bg-green-500' : 'bg-slate-200'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strength.label === tStr('veryStrong') ? 'bg-green-600' : 'bg-slate-200'} transition-all duration-300`} />
                  </div>
                  <span className={`text-xs w-16 text-right ${strength.textClass}`}>{strength.label}</span>
                </div>
              )}
            </div>

            <Input
              label={tAuth('confirmNewPasswordLabel')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirm_password')}
              error={errors.confirm_password?.message}
              disabled={isLoading}
            />

            <Button type="submit" disabled={isLoading} className="w-full py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : tAuth('resetPasswordButton')}
            </Button>
          </form>
        </>
      )}
    </div>
  );
};
