'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useRouter } from '../../lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Input, Button } from '@oikos/ui';
import { Alert } from '../ui/Alert';
import { useTranslations } from 'next-intl';

export const RegisterForm = () => {
  const router = useRouter();
  const tAuth = useTranslations('Auth');
  const tVal = useTranslations('Validation');
  const tApi = useTranslations('ApiErrors');
  const tStr = useTranslations('PasswordStrength');

  const registerSchema = useMemo(() => z.object({
    first_name: z.string().min(1, tVal('firstNameRequired')).max(100, tVal('firstNameLength')),
    last_name: z.string().min(1, tVal('lastNameRequired')).max(100, tVal('lastNameLength')),
    email: z.string().min(1, tVal('emailRequired')).email(tVal('emailInvalid')).max(255, tVal('emailLength')),
    password: z.string()
      .min(10, tVal('passwordMin'))
      .max(128, tVal('passwordLength'))
      .regex(/[A-Z]/, tVal('passwordUppercase'))
      .regex(/[a-z]/, tVal('passwordLowercase'))
      .regex(/[0-9]/, tVal('passwordNumber'))
      .regex(/[!@#$%^&*()_+\-=\[\]{}]/, tVal('passwordSpecial')),
    confirm_password: z.string().min(1, tVal('confirmPasswordRequired')),
    agreed_to_terms: z.boolean().refine((val) => val === true, {
      message: tVal('agreeToTermsRequired'),
    }),
  }).refine((data) => data.password === data.confirm_password, {
    message: tVal('passwordsDoNotMatch'),
    path: ["confirm_password"],
  }), [tVal]);

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const pw = watch('password', '');
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

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setErrorMsg(tApi('accountExists'));
        } else {
          setErrorMsg(result.detail?.detail || tApi('somethingWentWrong'));
        }
      } else {
        router.push('/onboarding/family');
      }
    } catch (err) {
      setErrorMsg(tApi('somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 p-8 sm:p-10 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-white mt-8 mb-8">
      <div className="flex flex-col items-center mb-6">
        <Link href="/login" className="text-slate-400 hover:text-slate-600 font-medium text-sm self-start mb-4 flex items-center gap-1 transition-colors">
          {tAuth('backToSignIn')}
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight text-center">{tAuth('createAccountTitle')}</h1>
        <p className="text-slate-500 mt-2 text-center font-medium">{tAuth('startEquipping')}</p>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            label={tAuth('firstNameLabel')}
            autoComplete="given-name"
            {...register('first_name')}
            error={errors.first_name?.message}
            disabled={isLoading}
          />
          <Input
            label={tAuth('lastNameLabel')}
            autoComplete="family-name"
            {...register('last_name')}
            error={errors.last_name?.message}
            disabled={isLoading}
          />
        </div>

        <Input
          label={tAuth('emailLabel')}
          type="email"
          autoComplete="email"
          {...register('email')}
          error={errors.email?.message}
          disabled={isLoading}
        />
        
        <div>
          <Input
            label={tAuth('passwordLabel')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
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
          label={tAuth('confirmPasswordLabel')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          {...register('confirm_password')}
          error={errors.confirm_password?.message}
          disabled={isLoading}
        />

        <div className="flex items-start gap-3 pt-2">
          <div className="flex items-center h-5 mt-0.5">
            <input
              id="agreed_to_terms"
              type="checkbox"
              className="w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 cursor-pointer transition-colors"
              {...register('agreed_to_terms')}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="agreed_to_terms" className="text-sm font-medium text-slate-700 cursor-pointer">
              {tAuth.rich('agreeToTerms', {
                terms: (chunks) => <a href="#" className="text-primary hover:underline">{chunks}</a>,
                privacy: (chunks) => <a href="#" className="text-primary hover:underline">{chunks}</a>
              })}
            </label>
            {errors.agreed_to_terms && <span className="text-xs font-semibold text-red-500 mt-1">{errors.agreed_to_terms.message}</span>}
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full mt-4 py-3.5 text-base rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:bg-[rgba(79,70,229,1)]">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : tAuth('createAccountButton')}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <Link href="/login" className="flex items-center justify-center gap-2 text-slate-600 font-medium hover:text-slate-900 transition-colors">
          <span>{tAuth('alreadyHaveAccount')}</span>
          <span className="text-primary font-bold hover:text-primary-hover hover:underline transition-all">{tAuth('signInButton')}</span>
        </Link>
      </div>
    </div>
  );
};
