'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Lightweight contentEditable rich-text editor — no external dependencies.
 *
 * Produces the same `{ html: string }` payload that the spec's Tiptap-based
 * editor would, so a future swap to Tiptap is purely a UI replacement.
 *
 * Server sanitises the HTML on save; the toolbar only emits a small allow-list
 * of tags (b/strong, i/em, u, ul, ol, li, a).
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // One-way sync: server value → DOM. Skip when the editor is focussed to
  // avoid clobbering live caret / IME input.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function handleLink() {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Only http(s) links are allowed.');
      return;
    }
    exec('createLink', url);
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1">
        <ToolbarButton onClick={() => exec('bold')} ariaLabel="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} ariaLabel="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} ariaLabel="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarButton>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton onClick={() => exec('insertUnorderedList')} ariaLabel="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} ariaLabel="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarButton onClick={handleLink} ariaLabel="Link"><LinkIcon className="w-3.5 h-3.5" /></ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        className="min-h-[6rem] px-3 py-2 text-sm text-slate-800 focus:outline-none prose prose-sm max-w-none"
        data-placeholder={placeholder || ''}
        suppressContentEditableWarning
      />
    </div>
  );
}

function ToolbarButton({
  children, onClick, ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  );
}
