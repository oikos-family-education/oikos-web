'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, ArrowRight, User } from 'lucide-react';
import { Button } from '@oikos/ui';
import { AddChildForm } from './AddChildForm';

interface ChildCard {
  first_name: string;
  nickname?: string;
  gender?: string;
  grade_level?: string;
}

export function ChildrenOnboarding() {
  const router = useRouter();
  const t = useTranslations('Onboarding');
  const [children, setChildren] = useState<ChildCard[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const handleChildAdded = (child: ChildCard) => {
    setChildren(prev => [...prev, child]);
    setShowForm(false);
  };

  const handleContinue = () => {
    if (children.length === 0 && !showSkipConfirm) {
      setShowSkipConfirm(true);
      return;
    }
    router.push('/onboarding/coat-of-arms');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">{t('childrenHeading')}</h1>
        <p className="text-slate-500 mt-2">{t('childrenSub')}</p>
      </div>

      {/* Child Cards */}
      {children.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children.map((child, i) => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl shadow-lg p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-indigo-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-slate-800">{child.first_name}</p>
                {child.nickname && <p className="text-sm text-slate-500">&quot;{child.nickname}&quot;</p>}
                {child.grade_level && <p className="text-xs text-slate-400 mt-1">{child.grade_level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Child Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 group"
        >
          <Plus className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
          <span className="text-slate-500 font-semibold group-hover:text-primary transition-colors">{t('addChild')}</span>
        </button>
      )}

      {/* Add Child Form (inline) */}
      {showForm && (
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl p-8">
          <AddChildForm
            onSuccess={handleChildAdded}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Skip confirmation */}
      {showSkipConfirm && children.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          {t('skipConfirm')}
        </div>
      )}

      {/* Continue Button — hidden while the add-child form is open */}
      {!showForm && <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          className="px-8 py-3 rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)]"
        >
          {t('continueButton')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>}
    </div>
  );
}
