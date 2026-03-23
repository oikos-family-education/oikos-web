'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FamilyFormData } from './FamilyWizard';

interface Props {
  data: FamilyFormData;
  onChange: (partial: Partial<FamilyFormData>) => void;
}

const EDUCATION_PURPOSES = [
  { value: 'full_homeschool', label: 'Full Homeschooling', desc: 'Our family handles all education at home' },
  { value: 'school_supplement', label: 'School & Home Partnership', desc: 'Children attend school, and we actively guide their learning at home' },
  { value: 'family_routine', label: 'Family Routine Planner', desc: 'Organise daily routines, activities, and family goals' },
];

const EDUCATION_METHODS = [
  { value: 'classical', label: 'Classical', desc: 'Trivium: grammar, logic, rhetoric' },
  { value: 'charlotte_mason', label: 'Charlotte Mason', desc: 'Living books, nature study, narration' },
  { value: 'montessori', label: 'Montessori', desc: 'Child-led, hands-on learning' },
  { value: 'unschooling', label: 'Unschooling', desc: 'Child-directed, interest-led' },
  { value: 'structured', label: 'Traditional / Structured', desc: 'Textbook, scheduled, grade-level' },
  { value: 'eclectic', label: 'Eclectic', desc: 'Mix of methods tailored to the child' },
  { value: 'waldorf', label: 'Waldorf', desc: 'Arts, rhythm, developmental stages' },
  { value: 'unit_study', label: 'Unit Studies', desc: 'Thematic cross-subject study' },
  { value: 'online', label: 'Online / Hybrid', desc: 'Primarily online curriculum' },
  { value: 'other', label: 'Other', desc: '—' },
];

const SCREEN_OPTIONS = [
  { value: 'screen_free', label: 'Screen-Free', desc: 'No screens in education or recreation' },
  { value: 'minimal', label: 'Minimal', desc: 'Occasional special use' },
  { value: 'moderate', label: 'Moderate', desc: 'Intentional, limited use' },
  { value: 'open', label: 'Open', desc: 'Screens used freely as tools' },
];

const OUTDOOR_OPTIONS = [
  { value: 'nature-centred', label: 'Nature-centred' },
  { value: 'outdoor-active', label: 'Outdoor-active' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'mainly-indoors', label: 'Mainly indoors' },
];


const SUGGESTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'Portuguese', 'German',
  'Italian', 'Dutch', 'Russian', 'Mandarin', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Turkish', 'Polish', 'Swedish',
];


const DIET_OPTIONS = [
  'Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Kosher', 'Halal', 'Gluten-free', 'Other',
];

export function WizardStep3({ data, onChange }: Props) {
  const t = useTranslations('Onboarding');
  const [curriculumInput, setCurriculumInput] = useState('');
  const [langInput, setLangInput] = useState('');

  const toggleMethod = (val: string) => {
    const current = data.education_methods;
    if (current.includes(val)) {
      onChange({ education_methods: current.filter(m => m !== val) });
    } else if (current.length < 3) {
      onChange({ education_methods: [...current, val] });
    }
  };

  const addCurriculum = () => {
    const val = curriculumInput.trim();
    if (val && data.current_curriculum.length < 8 && !data.current_curriculum.includes(val)) {
      onChange({ current_curriculum: [...data.current_curriculum, val] });
      setCurriculumInput('');
    }
  };

  const addLanguage = () => {
    const val = langInput.trim();
    if (val && !data.home_languages.includes(val)) {
      onChange({ home_languages: [...data.home_languages, val] });
      setLangInput('');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t('step3Heading')}</h2>
        <p className="text-slate-500 mt-1">{t('step3Sub')}</p>
      </div>

      {/* Education Purpose */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('educationPurposeLabel')}</label>
        <p className="text-xs text-slate-400">{t('educationPurposeHelp')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EDUCATION_PURPOSES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ education_purpose: p.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                data.education_purpose === p.value
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-semibold text-slate-700 block">{p.label}</span>
              <span className="text-xs text-slate-400 mt-1 block">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Education Method */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('educationLabel')}</label>
        <p className="text-xs text-slate-400">{t('educationHelp')}</p>
        <div className="grid grid-cols-2 gap-3">
          {EDUCATION_METHODS.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => toggleMethod(m.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                data.education_methods.includes(m.value)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              } ${data.education_methods.length >= 3 && !data.education_methods.includes(m.value) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-sm font-semibold text-slate-700 block">{m.label}</span>
              <span className="text-xs text-slate-400">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Curriculum Tags */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('curriculumLabel')}</label>
        <div className="flex gap-2">
          <input
            value={curriculumInput}
            onChange={(e) => setCurriculumInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCurriculum())}
            placeholder={t('curriculumPlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
          />
          <button type="button" onClick={addCurriculum} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.current_curriculum.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
              {c}
              <button type="button" onClick={() => onChange({ current_curriculum: data.current_curriculum.filter((_, j) => j !== i) })} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Screen Policy */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('screenLabel')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCREEN_OPTIONS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ screen_policy: s.value })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                data.screen_policy === s.value ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-sm font-semibold text-slate-700 block">{s.label}</span>
              <span className="text-xs text-slate-400">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Diet */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('dietLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ diet: d.toLowerCase().replace(/[^a-z]/g, '_') })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                data.diet === d.toLowerCase().replace(/[^a-z]/g, '_')
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Outdoor Orientation */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('outdoorLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {OUTDOOR_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ outdoor_orientation: o.value })}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                data.outdoor_orientation === o.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Home Languages */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('languagesLabel')}</label>
        <div className="flex gap-2">
          <input
            value={langInput}
            onChange={(e) => setLangInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
            placeholder={t('languagesPlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
          />
          <button type="button" onClick={addLanguage} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium">+</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_LANGUAGES.filter(l => !data.home_languages.includes(l)).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ home_languages: [...data.home_languages, l] })}
              className="px-2.5 py-1 text-xs rounded-full border border-slate-200 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
            >
              + {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.home_languages.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
              {l}
              <button type="button" onClick={() => onChange({ home_languages: data.home_languages.filter((_, j) => j !== i) })} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
