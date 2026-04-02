'use client';

import React, { useState } from 'react';
import { Check, Plus, ChevronDown, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { WeekTemplateSummary } from './types';

interface TemplateSelectorProps {
  templates: WeekTemplateSummary[];
  activeTemplateId: string | null;
  onSelect: (templateId: string) => void;
  onCreate: (name: string, isActive: boolean) => void;
  onRename?: (templateId: string, newName: string) => void;
}

export function TemplateSelector({
  templates,
  activeTemplateId,
  onSelect,
  onCreate,
  onRename,
}: TemplateSelectorProps) {
  const t = useTranslations('WeekPlanner');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const activeTemplate = templates.find(t => t.id === activeTemplateId);

  function handleCreate() {
    if (newName.trim()) {
      onCreate(newName.trim(), templates.length === 0);
      setNewName('');
      setCreating(false);
    }
  }

  function startRename(tmpl: WeekTemplateSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(tmpl.id);
    setEditName(tmpl.name);
  }

  function handleRename() {
    if (editingId && editName.trim() && onRename) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
      >
        <span className="text-slate-700">
          {activeTemplate?.name || t('templateSelector')}
        </span>
        {activeTemplate?.is_active && (
          <span className="text-xs text-green-600">✅</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setEditingId(null); }} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-40">
            <div className="py-1">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="group">
                  {editingId === tmpl.id ? (
                    <div className="flex gap-1.5 px-2 py-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <Button type="button" onClick={handleRename} className="!px-2 !py-1 text-xs">
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSelect(tmpl.id);
                        setOpen(false);
                      }}
                      className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-slate-50 ${
                        tmpl.id === activeTemplateId ? 'bg-slate-50' : ''
                      }`}
                    >
                      <span className="text-slate-700 truncate">{tmpl.name}</span>
                      <div className="flex items-center gap-1.5">
                        {onRename && (
                          <span
                            role="button"
                            onClick={(e) => startRename(tmpl, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 transition-opacity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {tmpl.is_active && (
                          <span className="text-xs text-green-600">✅</span>
                        )}
                        {tmpl.id === activeTemplateId && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-2">
              {creating ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder={t('templateNamePlaceholder')}
                    className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <Button type="button" onClick={handleCreate} className="!px-2 !py-1 text-xs">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-primary hover:bg-primary/5 rounded"
                >
                  <Plus className="w-4 h-4" />
                  {t('newTemplate')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
