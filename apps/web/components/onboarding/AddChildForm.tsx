'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';
import { Loader2, X } from 'lucide-react';

interface Props {
  onSuccess: (child: { first_name: string; nickname?: string; gender?: string; grade_level?: string }) => void;
  onCancel: () => void;
}

const GENDER_OPTIONS = ['male', 'female', 'prefer_not_to_say'];

const GRADE_OPTIONS = [
  { value: 'pre_k', label: 'Pre-K / Early Years (ages 3–5)' },
  { value: 'k', label: 'Kindergarten (age 5–6)' },
  { value: 'grade_1', label: 'Grade 1' },
  { value: 'grade_2', label: 'Grade 2' },
  { value: 'grade_3', label: 'Grade 3' },
  { value: 'grade_4', label: 'Grade 4' },
  { value: 'grade_5', label: 'Grade 5' },
  { value: 'grade_6', label: 'Grade 6' },
  { value: 'grade_7', label: 'Grade 7' },
  { value: 'grade_8', label: 'Grade 8' },
  { value: 'grade_9', label: 'Grade 9' },
  { value: 'grade_10', label: 'Grade 10' },
  { value: 'grade_11', label: 'Grade 11' },
  { value: 'grade_12', label: 'Grade 12' },
  { value: 'stage_early', label: 'Early Stage (not grade-based, ages 5–8)' },
  { value: 'stage_middle', label: 'Middle Stage (ages 9–12)' },
  { value: 'stage_upper', label: 'Upper Stage (ages 13–18)' },
  { value: 'graduated', label: 'Graduated / Post-secondary' },
];

const LEARNING_STYLES = [
  { value: 'visual', label: 'Visual', desc: 'Learns through images, maps, diagrams' },
  { value: 'auditory', label: 'Auditory', desc: 'Learns through listening and discussion' },
  { value: 'kinesthetic', label: 'Hands-On', desc: 'Learns by doing, building, moving' },
  { value: 'reading_writing', label: 'Reading & Writing', desc: 'Learns through text and note-taking' },
  { value: 'social', label: 'Social', desc: 'Thrives in group discussion and co-op' },
];

const LEARNING_DIFFERENCES = [
  'Dyslexia', 'Dysgraphia', 'Dyscalculia', 'ADHD (inattentive)', 'ADHD (combined)',
  'Autism Spectrum', 'Gifted / 2e', 'Sensory Processing', 'Visual impairment',
  'Hearing impairment', 'Speech / Language', 'Other',
];

export function AddChildForm({ onSuccess, onCancel }: Props) {
  const t = useTranslations('Onboarding');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('');
  const [dobMode, setDobMode] = useState<'dob' | 'age'>('dob');
  const [birthdate, setBirthdate] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [learningStyles, setLearningStyles] = useState<string[]>([]);
  const [personalityDesc, setPersonalityDesc] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [motivators, setMotivators] = useState('');
  const [demotivators, setDemotivators] = useState('');
  const [learningDifferences, setLearningDifferences] = useState<string[]>([]);
  const [accommodationsNotes, setAccommodationsNotes] = useState('');
  const [supportServices, setSupportServices] = useState<string[]>([]);
  const [supportInput, setSupportInput] = useState('');

  const toggleLearningStyle = (val: string) => {
    if (learningStyles.includes(val)) {
      setLearningStyles(learningStyles.filter(s => s !== val));
    } else if (learningStyles.length < 2) {
      setLearningStyles([...learningStyles, val]);
    }
  };

  const toggleDifference = (val: string) => {
    if (learningDifferences.includes(val)) {
      setLearningDifferences(learningDifferences.filter(d => d !== val));
    } else {
      setLearningDifferences([...learningDifferences, val]);
    }
  };

  const addInterest = () => {
    const val = interestInput.trim();
    if (val && interests.length < 15 && !interests.includes(val)) {
      setInterests([...interests, val]);
      setInterestInput('');
    }
  };

  const addSupport = () => {
    const val = supportInput.trim();
    if (val && !supportServices.includes(val)) {
      setSupportServices([...supportServices, val]);
      setSupportInput('');
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim()) return;
    setIsSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        nickname: nickname.trim() || undefined,
        gender: gender || undefined,
        grade_level: gradeLevel || undefined,
        learning_styles: learningStyles,
        personality_description: personalityDesc.trim() || undefined,
        interests,
        motivators: motivators.trim() || undefined,
        demotivators: demotivators.trim() || undefined,
        learning_differences: learningDifferences,
        accommodations_notes: accommodationsNotes.trim() || undefined,
        support_services: supportServices,
      };

      if (dobMode === 'dob' && birthdate) {
        payload.birthdate = birthdate;
      } else if (dobMode === 'age') {
        if (birthYear) payload.birth_year = parseInt(birthYear);
        if (birthMonth) payload.birth_month = parseInt(birthMonth);
      }

      const res = await fetch('/api/v1/families/me/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Something went wrong.');
        return;
      }

      onSuccess({
        first_name: firstName.trim(),
        nickname: nickname.trim() || undefined,
        gender: gender || undefined,
        grade_level: gradeLevel || undefined,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-800">{t('addChild')}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      {/* Basic Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('childNameLabel')} placeholder={t('childNamePlaceholder')} value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={60} />
        <Input label={t('childNicknameLabel')} placeholder={t('childNicknamePlaceholder')} value={nickname} onChange={e => setNickname(e.target.value)} maxLength={40} />
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childGenderLabel')}</label>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map(g => (
            <button key={g} type="button" onClick={() => setGender(g)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${gender === g ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {g === 'prefer_not_to_say' ? 'Prefer not to say' : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Date of Birth */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('childDobLabel')}</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={dobMode === 'dob'} onChange={() => setDobMode('dob')} className="accent-primary" />
            {t('dobOption')}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={dobMode === 'age'} onChange={() => setDobMode('age')} className="accent-primary" />
            {t('ageOption')}
          </label>
        </div>
        {dobMode === 'dob' ? (
          <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
        ) : (
          <div className="flex gap-3">
            <input type="number" placeholder="Year (e.g. 2015)" value={birthYear} onChange={e => setBirthYear(e.target.value)} min="1990" max="2030"
              className="w-40 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
            <input type="number" placeholder="Month (1-12)" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} min="1" max="12"
              className="w-40 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
          </div>
        )}
      </div>

      {/* Grade Level */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childGradeLabel')}</label>
        <p className="text-xs text-slate-400">{t('childGradeHint')}</p>
        <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-white">
          <option value="">Select…</option>
          {GRADE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {/* Learning Style */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">{t('childLearningStyleLabel')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEARNING_STYLES.map(ls => (
            <button key={ls.value} type="button" onClick={() => toggleLearningStyle(ls.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${learningStyles.includes(ls.value) ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'} ${learningStyles.length >= 2 && !learningStyles.includes(ls.value) ? 'opacity-50' : ''}`}>
              <span className="text-sm font-semibold text-slate-700 block">{ls.label}</span>
              <span className="text-xs text-slate-400">{ls.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Personality Description */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childPersonalityLabel')}</label>
        <textarea value={personalityDesc} onChange={e => setPersonalityDesc(e.target.value)} placeholder={t('childPersonalityPlaceholder')}
          maxLength={1000} rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none text-sm" />
        <p className="text-xs text-slate-400 text-right">{personalityDesc.length}/1,000</p>
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childInterestsLabel')}</label>
        <div className="flex gap-2">
          <input value={interestInput} onChange={e => setInterestInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInterest())}
            placeholder={t('childInterestsPlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
          <button type="button" onClick={addInterest} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {interests.map((int, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
              {int}
              <button type="button" onClick={() => setInterests(interests.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Motivators / Demotivators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{t('childMotivatorsLabel')}</label>
          <textarea value={motivators} onChange={e => setMotivators(e.target.value)} placeholder={t('childMotivatorsPlaceholder')} maxLength={200} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{t('childDemotivatorsLabel')}</label>
          <textarea value={demotivators} onChange={e => setDemotivators(e.target.value)} placeholder={t('childDemotivatorsPlaceholder')} maxLength={200} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-sm" />
        </div>
      </div>

      {/* Learning Differences */}
      <div className="space-y-3">
        <p className="text-xs text-slate-500 italic">{t('childNeedsIntro')}</p>
        <label className="text-sm font-semibold text-slate-700">{t('childDifferencesLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {LEARNING_DIFFERENCES.map(ld => (
            <button key={ld} type="button" onClick={() => toggleDifference(ld)}
              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${learningDifferences.includes(ld) ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {ld}
            </button>
          ))}
        </div>
      </div>

      {/* Accommodations */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childAccommodationsLabel')}</label>
        <textarea value={accommodationsNotes} onChange={e => setAccommodationsNotes(e.target.value)} placeholder={t('childAccommodationsPlaceholder')} maxLength={500} rows={2}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-sm" />
      </div>

      {/* Support Services */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">{t('childSupportLabel')}</label>
        <div className="flex gap-2">
          <input value={supportInput} onChange={e => setSupportInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSupport())}
            placeholder={t('childSupportPlaceholder')}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
          <button type="button" onClick={addSupport} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium">+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {supportServices.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
              {s}
              <button type="button" onClick={() => setSupportServices(supportServices.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !firstName.trim()}
          className="px-6 py-3 rounded-xl shadow-[0_4px_14px_0_rgb(99,102,241,0.39)]">
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (firstName.trim() ? t('addChildButton', { name: firstName.trim() }) : t('addChildDefault'))}
        </Button>
      </div>
    </div>
  );
}
