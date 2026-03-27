'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Edit3, BookOpen, Library } from 'lucide-react';
import { SubjectResources } from '../../../../../components/resources/SubjectResources';

interface Subject {
  id: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  category: string;
  color: string;
  icon: string | null;
  priority: number;
  is_platform_subject: boolean;
  family_id: string | null;
}

export default function SubjectDetailPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const router = useRouter();
  const t = useTranslations('Subjects');
  const tRes = useTranslations('Resources');

  const [subject, setSubject] = useState<Subject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources'>('overview');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/subjects/${subjectId}`, { credentials: 'include' });
      if (res.ok) {
        setSubject(await res.json());
      }
      setIsLoading(false);
    }
    load();
  }, [subjectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subject) {
    return <div className="text-center py-20 text-slate-500">Subject not found.</div>;
  }

  const tabs = [
    { key: 'overview' as const, label: t('editTitle').replace('Edit ', ''), icon: BookOpen },
    { key: 'resources' as const, label: tRes('resourcesTab'), icon: Library },
  ];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{subject.name}</h1>
          {subject.short_description && (
            <p className="text-slate-500 mt-1">{subject.short_description}</p>
          )}
        </div>
        {subject.family_id && !subject.is_platform_subject && (
          <button
            onClick={() => router.push(`/subjects/${subjectId}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {t('edit')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {subject.long_description ? (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{subject.long_description}</p>
          ) : (
            <p className="text-sm text-slate-400">{subject.short_description || 'No description.'}</p>
          )}
        </div>
      )}

      {activeTab === 'resources' && (
        <SubjectResources subjectId={subjectId} subjectName={subject.name} />
      )}
    </div>
  );
}
