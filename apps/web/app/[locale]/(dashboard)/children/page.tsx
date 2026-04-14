'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Star, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../../../lib/navigation';
import { Button } from '@oikos/ui';
import { ChildCard } from '../../../../components/children/ChildCard';
import { AddChildForm, ChildFormData } from '../../../../components/onboarding/AddChildForm';
import { ArchiveModal } from '../../../../components/children/ArchiveModal';

interface Child {
  id: string;
  family_id: string;
  first_name: string;
  nickname?: string;
  gender?: string;
  birthdate?: string;
  birth_year?: number;
  birth_month?: number;
  grade_level?: string;
  child_curriculum: string[];
  learning_styles: string[];
  personality_description?: string;
  interests: string[];
  motivators?: string;
  demotivators?: string;
  learning_differences: string[];
  accommodations_notes?: string;
  support_services: string[];
  is_active: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export default function ChildrenPage() {
  const t = useTranslations('Children');
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [archivingChild, setArchivingChild] = useState<Child | null>(null);
  const [archiveToast, setArchiveToast] = useState<{ name: string; id: string } | null>(null);

  const fetchChildren = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/families/me/children', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setChildren(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const handleChildAdded = (_child: ChildFormData & { id?: string }) => {
    setShowForm(false);
    setEditingChild(null);
    fetchChildren();
  };

  const handleEdit = (child: Child) => {
    setEditingChild(child);
    setShowForm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archivingChild) return;
    try {
      const res = await fetch(`/api/v1/families/me/children/${archivingChild.id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const name = archivingChild.first_name;
        const id = archivingChild.id;
        setArchivingChild(null);
        setArchiveToast({ name, id });
        fetchChildren();
        setTimeout(() => setArchiveToast(null), 10000);
      }
    } catch {
      // silently fail
    }
  };

  const handleUndo = async () => {
    if (!archiveToast) return;
    try {
      await fetch(`/api/v1/families/me/children/${archiveToast.id}/unarchive`, {
        method: 'POST',
        credentials: 'include',
      });
      setArchiveToast(null);
      fetchChildren();
    } catch {
      // silently fail
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingChild(null);
  };

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
        {children.length > 0 && !showForm && (
          <Button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t('addChild')}
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <AddChildForm
            onSuccess={handleChildAdded}
            onCancel={handleCancelForm}
            translationNamespace="Children"
            childId={editingChild?.id}
            initialData={editingChild ? {
              first_name: editingChild.first_name,
              nickname: editingChild.nickname,
              gender: editingChild.gender,
              birthdate: editingChild.birthdate,
              birth_year: editingChild.birth_year,
              birth_month: editingChild.birth_month,
              grade_level: editingChild.grade_level,
              learning_styles: editingChild.learning_styles,
              personality_description: editingChild.personality_description,
              interests: editingChild.interests,
              motivators: editingChild.motivators,
              demotivators: editingChild.demotivators,
              learning_differences: editingChild.learning_differences,
              accommodations_notes: editingChild.accommodations_notes,
              support_services: editingChild.support_services,
            } : undefined}
          />
        </div>
      )}

      {/* Children Grid */}
      {!showForm && children.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map(child => (
            <ChildCard
              key={child.id}
              child={child}
              onClick={() => router.push(`/children/${child.id}`)}
              onEdit={() => handleEdit(child)}
              onArchive={() => setArchivingChild(child)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!showForm && children.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Star className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">{t('emptyTitle')}</h2>
          <p className="text-slate-500 mb-6">{t('emptyDescription')}</p>
          <Button onClick={() => setShowForm(true)} className="px-6 py-3 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            {t('emptyAction')}
          </Button>
        </div>
      )}

      {/* Archive Modal */}
      {archivingChild && (
        <ArchiveModal
          childName={archivingChild.first_name}
          onConfirm={handleArchiveConfirm}
          onCancel={() => setArchivingChild(null)}
        />
      )}

      {/* Archive Toast */}
      {archiveToast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span>{t('archivedToast', { name: archiveToast.name })}</span>
          <button onClick={handleUndo} className="text-primary-light font-semibold hover:underline">
            {t('undo')}
          </button>
        </div>
      )}
    </div>
  );
}
