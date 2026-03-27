'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { useAuth } from '../../../../providers/AuthProvider';
import { PlannerGrid } from '../../../../components/planner/PlannerGrid';
import { SubjectPanel } from '../../../../components/planner/SubjectPanel';
import { RoutineEntryPopup } from '../../../../components/planner/RoutineEntryPopup';
import { TemplateSelector } from '../../../../components/planner/TemplateSelector';
import { ContextMenu } from '../../../../components/planner/ContextMenu';
import {
  RoutineEntryData,
  WeekTemplateData,
  WeekTemplateSummary,
  SubjectData,
  ChildData,
  CurriculumData,
  DragSubjectPayload,
  HOURS_START,
  HOURS_END,
  encodeCustomNotes,
} from '../../../../components/planner/types';

export default function PlannerPage() {
  const t = useTranslations('WeekPlanner');
  const { family } = useAuth();

  // Data state
  const [templates, setTemplates] = useState<WeekTemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<WeekTemplateData | null>(null);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [childrenData, setChildrenData] = useState<ChildData[]>([]);
  const [curriculums, setCurriculums] = useState<CurriculumData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // UI state
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [deleteTemplateConfirm, setDeleteTemplateConfirm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<RoutineEntryData | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entryId: string } | null>(null);
  const [dragActive, setDragActive] = useState<DragSubjectPayload | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Debounced save
  const saveTimeout = useRef<NodeJS.Timeout>();

  // --- Data fetching ---
  const fetchTemplates = useCallback(async () => {
    const res = await fetch('/api/v1/week-planner/templates', { credentials: 'include' });
    if (res.ok) {
      const data: WeekTemplateSummary[] = await res.json();
      setTemplates(data);
      return data;
    }
    return [];
  }, []);

  const fetchTemplate = useCallback(async (templateId: string) => {
    const res = await fetch(`/api/v1/week-planner/templates/${templateId}`, { credentials: 'include' });
    if (res.ok) {
      const data: WeekTemplateData = await res.json();
      setActiveTemplate(data);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    const res = await fetch('/api/v1/subjects?source=mine', { credentials: 'include' });
    if (res.ok) setSubjects(await res.json());
  }, []);

  const fetchChildren = useCallback(async () => {
    const res = await fetch('/api/v1/families/me/children', { credentials: 'include' });
    if (res.ok) setChildrenData(await res.json());
  }, []);

  const fetchCurriculums = useCallback(async () => {
    const res = await fetch('/api/v1/curriculums', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      // Fetch full details for active curriculums to get curriculum_subjects
      const detailed: CurriculumData[] = [];
      for (const c of data) {
        if (c.status === 'active') {
          const detailRes = await fetch(`/api/v1/curriculums/${c.id}`, { credentials: 'include' });
          if (detailRes.ok) detailed.push(await detailRes.json());
        }
      }
      setCurriculums(detailed);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchSubjects(), fetchChildren(), fetchCurriculums()]);
      const tmpls = await fetchTemplates();
      // Load the active template, or the first one
      const active = tmpls.find(t => t.is_active) || tmpls[0];
      if (active) {
        await fetchTemplate(active.id);
      }
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Toast ---
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  // --- API operations ---
  async function createTemplate(name: string, isActive: boolean) {
    const res = await fetch('/api/v1/week-planner/templates', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, is_active: isActive }),
    });
    if (res.ok) {
      const newTemplate: WeekTemplateData = await res.json();
      await fetchTemplates();
      setActiveTemplate(newTemplate);
    }
  }

  async function selectTemplate(templateId: string) {
    await fetchTemplate(templateId);
  }

  async function activateTemplate() {
    if (!activeTemplate || activeTemplate.is_active) return;
    const res = await fetch(`/api/v1/week-planner/templates/${activeTemplate.id}/activate`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await fetchTemplates();
      await fetchTemplate(activeTemplate.id);
    }
  }

  async function deleteTemplate() {
    if (!activeTemplate) return;
    const res = await fetch(`/api/v1/week-planner/templates/${activeTemplate.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      const remaining = await fetchTemplates();
      const next = remaining.find((t: WeekTemplateSummary) => t.is_active) || remaining[0];
      if (next) {
        await fetchTemplate(next.id);
      } else {
        setActiveTemplate(null);
      }
    }
    setDeleteTemplateConfirm(false);
  }

  async function clearWeek() {
    if (!activeTemplate) return;
    const res = await fetch(`/api/v1/week-planner/templates/${activeTemplate.id}/entries`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setActiveTemplate(prev => prev ? { ...prev, entries: [] } : null);
      setClearConfirm(false);
    }
  }

  // --- Entry CRUD ---
  async function createEntry(data: {
    subject_id: string | null;
    is_free_time: boolean;
    child_ids: string[];
    day_of_week: number;
    start_minute: number;
    duration_minutes: number;
    priority: string;
    color: string | null;
    notes?: string;
  }) {
    if (!activeTemplate) return;
    const res = await fetch(`/api/v1/week-planner/templates/${activeTemplate.id}/entries`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setToast(err.detail || 'Error');
      return null;
    }
    const entry: RoutineEntryData = await res.json();
    setActiveTemplate(prev => prev ? { ...prev, entries: [...prev.entries, entry] } : null);
    return entry;
  }

  function debouncedUpdateEntry(entryId: string, updates: Record<string, unknown>) {
    // Optimistic update
    setActiveTemplate(prev => {
      if (!prev) return null;
      return {
        ...prev,
        entries: prev.entries.map(e =>
          e.id === entryId ? { ...e, ...updates } : e
        ),
      };
    });

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/week-planner/entries/${entryId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        // Revert on error
        if (activeTemplate) await fetchTemplate(activeTemplate.id);
        const err = await res.json();
        setToast(err.detail || 'Error');
      }
    }, 500);
  }

  async function deleteEntry(entryId: string) {
    // Optimistic
    setActiveTemplate(prev => {
      if (!prev) return null;
      return { ...prev, entries: prev.entries.filter(e => e.id !== entryId) };
    });
    await fetch(`/api/v1/week-planner/entries/${entryId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }

  async function duplicateEntry(entryId: string, targetDays: number[]) {
    const res = await fetch(`/api/v1/week-planner/entries/${entryId}/duplicate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_days: targetDays }),
    });
    if (res.ok) {
      const newEntries: RoutineEntryData[] = await res.json();
      setActiveTemplate(prev =>
        prev ? { ...prev, entries: [...prev.entries, ...newEntries] } : null
      );
    }
  }

  function handleUpdateTime(entryId: string, startMinute: number) {
    debouncedUpdateEntry(entryId, { start_minute: startMinute });
  }

  function handleResize(entryId: string, durationMinutes: number) {
    debouncedUpdateEntry(entryId, { duration_minutes: durationMinutes });
  }

  function handleSaveEntry(entryId: string, updates: Partial<RoutineEntryData>) {
    debouncedUpdateEntry(entryId, updates);
  }

  function handleSaveAllDuplicates(sourceEntry: RoutineEntryData, updates: Partial<RoutineEntryData>) {
    // Find all entries that are "duplicates" — same subject, same children, same time
    const allDuplicates = entries.filter(e =>
      e.subject_id === sourceEntry.subject_id &&
      e.is_free_time === sourceEntry.is_free_time &&
      e.start_minute === sourceEntry.start_minute &&
      e.duration_minutes === sourceEntry.duration_minutes &&
      JSON.stringify([...e.child_ids].sort()) === JSON.stringify([...sourceEntry.child_ids].sort())
    );
    for (const entry of allDuplicates) {
      debouncedUpdateEntry(entry.id, updates);
    }
  }

  function handleDeleteAllDuplicates(sourceEntry: RoutineEntryData) {
    const allDuplicates = entries.filter(e =>
      e.subject_id === sourceEntry.subject_id &&
      e.is_free_time === sourceEntry.is_free_time &&
      e.start_minute === sourceEntry.start_minute &&
      e.duration_minutes === sourceEntry.duration_minutes &&
      JSON.stringify([...e.child_ids].sort()) === JSON.stringify([...sourceEntry.child_ids].sort())
    );
    for (const entry of allDuplicates) {
      deleteEntry(entry.id);
    }
  }

  // --- DnD ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === 'subject') {
      setDragActive(data as DragSubjectPayload);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragActive(null);
    const { active, over } = event;
    if (!over) return;

    const dropData = over.data.current as { dayIndex: number; hour: number } | undefined;
    if (!dropData) return;

    const activeData = active.data.current;
    if (!activeData) return;

    const { dayIndex, hour } = dropData;
    const startMinute = hour * 60;

    // Clamp to 22:00
    const maxStart = HOURS_END * 60;
    const clampedStart = Math.min(startMinute, maxStart);

    if (activeData.type === 'subject') {
      // Dragging from panel
      const payload = activeData as DragSubjectPayload;
      let duration = payload.durationMinutes;
      // Truncate if overflows past 22:00
      if (clampedStart + duration > maxStart) {
        duration = maxStart - clampedStart;
        if (duration > 0) setToast(t('overflowWarning'));
      }
      if (duration <= 0) return;

      const isCustom = payload.subjectId === '__custom__';
      await createEntry({
        subject_id: payload.isFreeTime || isCustom ? null : payload.subjectId,
        is_free_time: payload.isFreeTime,
        child_ids: payload.childIds,
        day_of_week: dayIndex,
        start_minute: clampedStart,
        duration_minutes: duration,
        priority: payload.priority,
        color: payload.color,
        notes: isCustom ? encodeCustomNotes(payload.icon || '🎯', payload.subjectName) : undefined,
      });
    } else if (activeData.type === 'entry') {
      // Moving existing entry
      const entryId = activeData.entryId as string;
      debouncedUpdateEntry(entryId, {
        day_of_week: dayIndex,
        start_minute: clampedStart,
      });
    }
  }

  // --- Conflict detection for visual feedback ---
  const conflictCells = new Set<string>();
  if (dragActive && !dragActive.isFreeTime && activeTemplate) {
    for (let day = 0; day < 7; day++) {
      for (let hour = HOURS_START; hour <= HOURS_END; hour++) {
        const proposedStart = hour * 60;
        const proposedEnd = proposedStart + dragActive.durationMinutes;
        const hasConflict = activeTemplate.entries.some(e => {
          if (e.is_free_time) return false;
          if (e.day_of_week !== day) return false;
          const eEnd = e.start_minute + e.duration_minutes;
          if (proposedStart >= eEnd || proposedEnd <= e.start_minute) return false;
          // Check child overlap
          const overlap = dragActive.childIds.some(cid => e.child_ids.includes(cid));
          return overlap;
        });
        if (hasConflict) conflictCells.add(`${day}-${hour}`);
      }
    }
  }

  // --- Context menu handling ---
  function handleContextMenu(e: React.MouseEvent, entryId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entryId });
  }

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No template state
  if (!activeTemplate && templates.length === 0) {
    return (
      <div className="max-w-5xl">
        <div className="text-center py-16">
          <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
            <Loader2 className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{t('noTemplates')}</h2>
          <p className="text-slate-500 mt-1 mb-4">{t('createFirstTemplate')}</p>
          <Button type="button" onClick={() => createTemplate('My Weekly Routine', true)}>
            {t('createTemplate')}
          </Button>
        </div>
      </div>
    );
  }

  const entries = activeTemplate?.entries || [];

  return (
    <div className="flex flex-col h-full -m-6 lg:-m-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800">{t('title')}</h1>
          <TemplateSelector
            templates={templates}
            activeTemplateId={activeTemplate?.id || null}
            onSelect={selectTemplate}
            onCreate={createTemplate}
          />
        </div>
        <div className="flex items-center gap-2">
          {activeTemplate && !activeTemplate.is_active && (
            <Button type="button" onClick={activateTemplate} className="text-sm !px-3 !py-1.5">
              {t('setAsActive')}
            </Button>
          )}
          {clearConfirm ? (
            <div className="flex items-center gap-1">
              <Button type="button" onClick={clearWeek} className="text-sm !px-3 !py-1.5 !bg-red-500 hover:!bg-red-600">
                <Trash2 className="w-4 h-4 mr-1" />
                {t('clearWeek')}
              </Button>
              <button
                onClick={() => setClearConfirm(false)}
                className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setClearConfirm(true)}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {t('clearWeek')}
            </button>
          )}
          {deleteTemplateConfirm ? (
            <div className="flex items-center gap-1">
              <Button type="button" onClick={deleteTemplate} className="text-sm !px-3 !py-1.5 !bg-red-500 hover:!bg-red-600">
                <Trash2 className="w-4 h-4 mr-1" />
                {t('deleteRoutine')}
              </Button>
              <button
                onClick={() => setDeleteTemplateConfirm(false)}
                className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteTemplateConfirm(true)}
              className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
            >
              {t('deleteRoutine')}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          <SubjectPanel
            subjects={subjects}
            childrenList={childrenData}
            curriculums={curriculums}
            entries={entries}
            collapsed={panelCollapsed}
            onToggle={() => setPanelCollapsed(!panelCollapsed)}
          />

          <PlannerGrid
            entries={entries}
            subjects={subjects}
            childrenList={childrenData}
            onEntryClick={setSelectedEntry}
            onUpdateTime={handleUpdateTime}
            onResize={handleResize}
            onContextMenu={handleContextMenu}
            conflictCells={conflictCells}
          />
        </div>

        <DragOverlay>
          {dragActive && (
            <div
              className="px-3 py-2 rounded-lg shadow-lg border text-sm font-medium text-slate-800 bg-white opacity-80"
              style={{ borderLeftWidth: '4px', borderLeftColor: dragActive.color }}
            >
              {dragActive.icon && <span className="mr-1">{dragActive.icon}</span>}
              {dragActive.subjectName}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Entry popup */}
      {selectedEntry && (
        <RoutineEntryPopup
          entry={selectedEntry}
          subject={selectedEntry.subject_id ? subjects.find(s => s.id === selectedEntry.subject_id) || null : null}
          childrenList={childrenData}
          allEntries={entries}
          onSave={handleSaveEntry}
          onSaveAllDuplicates={handleSaveAllDuplicates}
          onDelete={deleteEntry}
          onDeleteAllDuplicates={handleDeleteAllDuplicates}
          onDuplicate={duplicateEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={() => {
            const entry = entries.find(e => e.id === contextMenu.entryId);
            if (entry) setSelectedEntry(entry);
          }}
          onDuplicate={() => {
            const entry = entries.find(e => e.id === contextMenu.entryId);
            if (entry) setSelectedEntry(entry);
          }}
          onDelete={() => deleteEntry(contextMenu.entryId)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
