'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '../../../../../../lib/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../../../../../lib/apiFetch';

export default function JoinByTokenPage() {
  const t = useTranslations('Community.errors');
  const params = useParams();
  const router = useRouter();
  const token = decodeURIComponent(params.token as string);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/v1/communities/join/by-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          const data = await res.json();
          router.replace(`/community/${data.slug}`);
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body.detail || t('invalidToken'));
        }
      } catch {
        setError(t('generic'));
      }
    })();
  }, [token, router, t]);

  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Joining…</span>
        </div>
      )}
    </div>
  );
}
