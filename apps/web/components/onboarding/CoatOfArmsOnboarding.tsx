'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldBuilder, type ShieldConfig } from './ShieldBuilder';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@oikos/ui';

const defaultShield: ShieldConfig = {
  initials: '',
  shape: 'heater',
  primary_color: '#1B2A4A',
  secondary_color: '#C5A84B',
  accent_color: '#1C1C1C',
  symbol_color: '#FFFFFF',
  division: 'none',
  crest_animal: 'none',
  flourish: 'none',
  center_symbol: 'none',
  motto: '',
  font_style: 'serif',
};

export function CoatOfArmsOnboarding() {
  const router = useRouter();
  const t = useTranslations('Onboarding');
  const [shieldConfig, setShieldConfig] = useState<ShieldConfig>(defaultShield);
  const [familyName, setFamilyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch family data to get family name and auto-generate initials
  useEffect(() => {
    async function fetchFamily() {
      try {
        const res = await fetch('/api/v1/families/me', { credentials: 'include' });
        if (res.ok) {
          const family = await res.json();
          setFamilyName(family.family_name);
          const words = family.family_name.trim().split(/\s+/);
          const initials = words
            .slice(0, 3)
            .map((w: string) => w[0]?.toUpperCase() || '')
            .join('');
          setShieldConfig(prev => ({ ...prev, initials }));

          // If shield already exists, pre-populate
          if (family.shield_config && Object.keys(family.shield_config).length > 0 && family.shield_config.initials) {
            setShieldConfig(family.shield_config);
          }
        }
      } catch {
        // Non-critical, continue with defaults
      } finally {
        setIsLoading(false);
      }
    }
    fetchFamily();
  }, []);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/v1/families/me/shield', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shieldConfig),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.detail === 'string' ? data.detail : 'Something went wrong.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">{t('coatOfArmsHeading')}</h1>
        <p className="text-slate-500 mt-2">{t('coatOfArmsSub')}</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl p-8 sm:p-10">
        <ShieldBuilder
          config={shieldConfig}
          familyName={familyName}
          onChange={setShieldConfig}
        />

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-700 font-medium transition-colors text-sm"
          >
            {t('coatOfArmsSkip')}
          </button>

          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)]"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <><CheckCircle2 className="w-5 h-5 mr-2" /> {t('coatOfArmsSave')}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
