'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bold, Italic, Link as LinkIcon, Code, List, ListOrdered, Quote, FileCode,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Pure-markdown formatting toolbar (v2 spec §4.1). Buttons mutate the textarea
 * value as string transforms — no rich-text editor, no contenteditable.
 */
export function MarkdownToolbar({ value, onChange, textareaRef }: Props) {
  const t = useTranslations('Community.forum.toolbar');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  function withSelection(transform: (sel: string, before: string, after: string) => { next: string; cursor?: number }) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const sel = value.slice(start, end);
    const { next, cursor } = transform(sel, before, after);
    onChange(next);
    // Restore selection on next tick after React re-render
    requestAnimationFrame(() => {
      const target = cursor ?? before.length + (next.length - before.length - after.length);
      el.focus();
      el.setSelectionRange(target, target);
    });
  }

  function wrap(marker: string) {
    withSelection((sel, before, after) => ({
      next: `${before}${marker}${sel || ''}${marker}${after}`,
    }));
  }

  function prefixLines(prefix: string) {
    withSelection((sel, before, after) => {
      const lines = (sel || 'list item').split('\n').map((l) => `${prefix}${l}`).join('\n');
      return { next: `${before}${lines}${after}` };
    });
  }

  function orderedList() {
    withSelection((sel, before, after) => {
      const src = sel || 'list item';
      const lines = src.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n');
      return { next: `${before}${lines}${after}` };
    });
  }

  function codeBlock() {
    withSelection((sel, before, after) => ({
      next: `${before}\n\`\`\`\n${sel || ''}\n\`\`\`\n${after}`,
    }));
  }

  function insertLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const safe = /^(https?:|mailto:)/i.test(url);
    if (!safe) return;
    withSelection((sel, before, after) => ({
      next: `${before}[${sel || 'link'}](${url})${after}`,
    }));
    setLinkUrl('');
    setLinkOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === 'b') { e.preventDefault(); wrap('**'); }
    else if (e.key === 'i') { e.preventDefault(); wrap('*'); }
    else if (e.key === 'k') { e.preventDefault(); setLinkOpen(true); }
  }

  // Wire keyboard listener through a stable callback the parent must bind
  // onto its <textarea>. Easier: re-export via a ref attribute pattern.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => onKey(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textareaRef, value]);

  const btn = "p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-800";

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border border-slate-200 border-b-0 rounded-t-lg bg-slate-50">
      <button type="button" title={t('bold')} onClick={() => wrap('**')} className={btn}>
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" title={t('italic')} onClick={() => wrap('*')} className={btn}>
        <Italic className="w-4 h-4" />
      </button>
      <button type="button" title={t('link')} onClick={() => setLinkOpen((v) => !v)} className={btn}>
        <LinkIcon className="w-4 h-4" />
      </button>
      <button type="button" title={t('code')} onClick={() => wrap('`')} className={btn}>
        <Code className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-slate-200 mx-1" />
      <button type="button" title={t('ul')} onClick={() => prefixLines('- ')} className={btn}>
        <List className="w-4 h-4" />
      </button>
      <button type="button" title={t('ol')} onClick={orderedList} className={btn}>
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" title={t('quote')} onClick={() => prefixLines('> ')} className={btn}>
        <Quote className="w-4 h-4" />
      </button>
      <button type="button" title={t('codeBlock')} onClick={codeBlock} className={btn}>
        <FileCode className="w-4 h-4" />
      </button>

      {linkOpen && (
        <div className="ml-2 flex items-center gap-1">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={t('linkUrlPlaceholder')}
            className="px-2 py-1 text-xs border border-slate-300 rounded"
          />
          <button
            type="button"
            onClick={insertLink}
            className="text-xs px-2 py-1 bg-primary text-white rounded"
          >
            {t('linkInsert')}
          </button>
        </div>
      )}
    </div>
  );
}
