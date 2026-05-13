'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  initialFirstName: string;
  initialLastName: string;
  email: string;
  onNameSaved: (firstName: string, lastName: string) => void;
}

export function AccountInfoSection({ initialFirstName, initialLastName, email, onNameSaved }: Props) {
  const t = useTranslations('Settings');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const schema = z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { first_name: initialFirstName, last_name: initialLastName },
  });

  async function onSubmit(data: { first_name: string; last_name: string }) {
    setError('');
    setSaved(false);
    const res = await fetch('/api/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setError(t('errorGeneric'));
      return;
    }
    onNameSaved(data.first_name, data.last_name);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('accountTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('accountSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('firstName')}
            required
            {...register('first_name')}
            error={errors.first_name?.message}
          />
          <Input
            label={t('lastName')}
            required
            {...register('last_name')}
            error={errors.last_name?.message}
          />
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">{t('emailAddress')}</label>
          <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm select-none">
            {email}
          </div>
          <span className="text-xs text-slate-400">Email changes are not yet supported.</span>
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : t('saveChanges')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              {t('changesSaved')}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
