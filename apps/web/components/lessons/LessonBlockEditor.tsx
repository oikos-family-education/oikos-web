'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, Trash2, Copy } from 'lucide-react';
import type { LessonBlock, LessonBlockType } from '../../lib/lessonUtils';
import { RichTextEditor } from './RichTextEditor';

interface LessonBlockEditorProps {
  block: LessonBlock;
  onChange: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function LessonBlockEditor(props: LessonBlockEditorProps) {
  const t = useTranslations('Lessons');
  const { block, onChange, onDelete, onDuplicate, dragHandleProps } = props;

  return (
    <div className="group relative flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-primary/30">
      <button
        type="button"
        aria-label={t('blockDragAria')}
        className="mt-1 inline-flex w-5 h-5 items-center justify-center rounded text-slate-400 hover:text-slate-600 cursor-grab"
        {...(dragHandleProps || {})}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <BlockBody block={block} onChange={onChange} />
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button
          type="button"
          aria-label={t('blockDuplicateAria')}
          onClick={onDuplicate}
          className="inline-flex w-7 h-7 items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          aria-label={t('blockDeleteAria')}
          onClick={onDelete}
          className="inline-flex w-7 h-7 items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function BlockBody({
  block, onChange,
}: {
  block: LessonBlock;
  onChange: (content: Record<string, unknown>) => void;
}) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} onChange={onChange} />;
    case 'heading':
      return <HeadingBlock block={block} onChange={onChange} />;
    case 'link':
      return <LinkBlock block={block} onChange={onChange} />;
    case 'image_url':
      return <ImageBlock block={block} onChange={onChange} />;
    case 'video_embed':
      return <VideoBlock block={block} onChange={onChange} />;
    case 'checklist':
      return <ChecklistBlock block={block} onChange={onChange} />;
    case 'callout':
      return <CalloutBlock block={block} onChange={onChange} />;
    case 'divider':
      return <hr className="my-2 border-slate-200" />;
    default:
      return <p className="text-xs text-slate-500">Unsupported block type: {block.type}</p>;
  }
}

// ── Text block ─────────────────────────────────────────────────────────────

function TextBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const t = useTranslations('Lessons');
  const html = (block.content?.html as string) || '';
  return (
    <RichTextEditor
      value={html}
      onChange={(v) => onChange({ html: v })}
      placeholder={t('blockTextPlaceholder')}
    />
  );
}

// ── Heading ────────────────────────────────────────────────────────────────

function HeadingBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const t = useTranslations('Lessons');
  const level = Number(block.content?.level) || 2;
  const text = (block.content?.text as string) || '';
  return (
    <div className="flex items-center gap-2">
      <select
        value={level}
        onChange={(e) => onChange({ level: Number(e.target.value), text })}
        className="text-xs rounded border border-slate-200 px-2 py-1 bg-white"
      >
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>
      <input
        type="text"
        value={text}
        placeholder={t('blockHeadingPlaceholder')}
        onChange={(e) => onChange({ level, text: e.target.value })}
        className="flex-1 text-base font-semibold text-slate-800 bg-transparent focus:outline-none"
      />
    </div>
  );
}

// ── Link ───────────────────────────────────────────────────────────────────

function LinkBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const t = useTranslations('Lessons');
  const [url, setUrl] = useState((block.content?.url as string) || '');
  const [title, setTitle] = useState((block.content?.title as string) || '');
  const [description, setDescription] = useState((block.content?.description as string) || '');
  const [favicon, setFavicon] = useState((block.content?.favicon_url as string) || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUrl((block.content?.url as string) || '');
    setTitle((block.content?.title as string) || '');
    setDescription((block.content?.description as string) || '');
    setFavicon((block.content?.favicon_url as string) || '');
  }, [block.id, block.content]);

  async function fetchPreview(targetUrl: string) {
    if (!/^https?:\/\//i.test(targetUrl)) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/lessons/link-preview?url=${encodeURIComponent(targetUrl)}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || '');
        setDescription(data.description || '');
        setFavicon(data.favicon_url || '');
        onChange({
          url: targetUrl,
          title: data.title || '',
          description: data.description || '',
          favicon_url: data.favicon_url || '',
        });
      }
    } catch {
      // best-effort — leave url-only preview
    } finally {
      setLoading(false);
    }
  }

  function commitUrl(value: string) {
    setUrl(value);
    onChange({ url: value, title, description, favicon_url: favicon });
    if (value && /^https?:\/\//i.test(value)) {
      fetchPreview(value);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={(e) => commitUrl(e.target.value)}
        placeholder={t('blockLinkPlaceholder')}
        className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
      />
      {loading && <p className="text-xs text-slate-500">{t('linkPreviewLoading')}</p>}
      {title || description ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 flex items-start gap-2">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{title || url}</p>
            {description ? <p className="text-xs text-slate-500 line-clamp-2">{description}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Image ──────────────────────────────────────────────────────────────────

function ImageBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const url = (block.content?.url as string) || '';
  const alt = (block.content?.alt as string) || '';
  const caption = (block.content?.caption as string) || '';
  return (
    <div className="space-y-2">
      <input
        type="url"
        value={url}
        onChange={(e) => onChange({ url: e.target.value, alt, caption })}
        placeholder="https://..."
        className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
      />
      <input
        type="text"
        value={caption}
        onChange={(e) => onChange({ url, alt, caption: e.target.value })}
        placeholder="Caption (optional)"
        className="w-full text-xs rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
      />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="rounded max-h-64 border border-slate-200" />
      ) : null}
    </div>
  );
}

// ── Video ──────────────────────────────────────────────────────────────────

function VideoBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const url = (block.content?.url as string) || '';
  const title = (block.content?.title as string) || '';
  return (
    <div className="space-y-2">
      <input
        type="url"
        value={url}
        onChange={(e) => onChange({ url: e.target.value, title })}
        placeholder="YouTube / Vimeo URL"
        className="w-full text-sm rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => onChange({ url, title: e.target.value })}
        placeholder="Title (optional)"
        className="w-full text-xs rounded border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-primary"
      />
    </div>
  );
}

// ── Checklist ──────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

function ChecklistBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const t = useTranslations('Lessons');
  const items = ((block.content?.items as ChecklistItem[]) || []);

  function update(next: ChecklistItem[]) {
    onChange({ items: next });
  }

  function addItem() {
    update([
      ...items,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', checked: false },
    ]);
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.checked}
            onChange={(e) =>
              update(items.map((it, i) => (i === idx ? { ...it, checked: e.target.checked } : it)))
            }
            className="rounded border-slate-300"
          />
          <input
            type="text"
            value={item.text}
            onChange={(e) =>
              update(items.map((it, i) => (i === idx ? { ...it, text: e.target.value } : it)))
            }
            placeholder="..."
            className="flex-1 text-sm bg-transparent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => update(items.filter((_, i) => i !== idx))}
            aria-label="Remove item"
            className="text-slate-400 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="text-xs font-medium text-primary hover:text-primary-hover"
      >
        + {t('blockChecklistAdd')}
      </button>
    </div>
  );
}

// ── Callout ────────────────────────────────────────────────────────────────

function CalloutBlock({ block, onChange }: { block: LessonBlock; onChange: (c: Record<string, unknown>) => void }) {
  const t = useTranslations('Lessons');
  const icon = (block.content?.icon as string) || '💡';
  const text = (block.content?.text as string) || '';
  const color = (block.content?.color as string) || 'blue';
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={icon}
          maxLength={2}
          onChange={(e) => onChange({ icon: e.target.value, text, color })}
          className="w-7 h-7 text-center text-lg bg-transparent focus:outline-none"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => onChange({ icon, text: e.target.value, color })}
          placeholder={t('blockCalloutPlaceholder')}
          className="flex-1 text-sm bg-transparent focus:outline-none"
        />
      </div>
    </div>
  );
}
