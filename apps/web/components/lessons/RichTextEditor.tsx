'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold,
  ChevronDown, Eraser, Indent, Italic, Link as LinkIcon, List,
  ListOrdered, Minus, Outdent, Palette, Smile, Strikethrough,
  Type, Underline, Sigma,
} from 'lucide-react';
import { marked } from 'marked';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';

// Configure marked once. GFM + line breaks gives the friendliest behaviour
// for content people typically paste (READMEs, ChatGPT output, etc.).
marked.setOptions({ gfm: true, breaks: true });

/**
 * Heuristic detector: does this plain-text clipboard payload look like
 * markdown? We're conservative — if NONE of these markers appear, we
 * let the default paste behaviour run (which keeps line breaks intact
 * but doesn't transform anything).
 */
const MARKDOWN_PATTERNS: RegExp[] = [
  /^#{1,6}\s+\S/m,            // # heading (with content)
  /^[-*+]\s+\S/m,             // - bullet list
  /^\d+\.\s+\S/m,             // 1. ordered list
  /^>\s+\S/m,                 // > blockquote
  /^(?:-{3,}|\*{3,}|_{3,})\s*$/m, // --- hr
  /^```/m,                    // ``` fenced code
  /\*\*[^*\n]+\*\*/,          // **bold**
  /__[^_\n]+__/,              // __bold__
  /(?<![*\w])\*[^*\n]+\*(?!\*)/, // *italic*
  /(?<![_\w])_[^_\n]+_(?!_)/, // _italic_
  /`[^`\n]+`/,                // `inline code`
  /\[[^\]\n]+\]\([^)\s]+\)/,  // [text](url)
  /!\[[^\]\n]*\]\([^)\s]+\)/, // ![alt](url)
];

function looksLikeMarkdown(text: string): boolean {
  if (text.length < 3) return false;
  return MARKDOWN_PATTERNS.some((p) => p.test(text));
}

/**
 * Strip obvious script/iframe/event-handler injections from the HTML
 * marked produces. The editor's other commands (link, etc.) also
 * insert HTML without sanitisation, so we match the existing trust
 * model while still cutting off the worst bits of a hostile paste.
 */
function sanitiseMarkdownHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\sjavascript\s*:/gi, '');
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

type BlockTag = 'P' | 'H1' | 'H2' | 'H3' | 'BLOCKQUOTE' | 'PRE';

const BLOCK_OPTIONS: Array<{ value: BlockTag; label: string }> = [
  { value: 'P',          label: 'Normal text' },
  { value: 'H1',         label: 'Heading 1' },
  { value: 'H2',         label: 'Heading 2' },
  { value: 'H3',         label: 'Heading 3' },
  { value: 'BLOCKQUOTE', label: 'Quote' },
  { value: 'PRE',        label: 'Code block' },
];

const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Inter, system-ui, sans-serif', label: 'Sans serif' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { value: 'ui-monospace, SFMono-Regular, Menlo, monospace', label: 'Monospace' },
];

// execCommand fontSize accepts 1-7 (legacy). Map to readable labels.
const SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '2', label: 'Small' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Large' },
  { value: '7', label: 'Huge' },
];

const COLOR_SWATCHES = [
  '#0f172a', '#475569', '#94a3b8', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
];

const EMOJI_GROUPS: Array<{ name: string; chars: string[] }> = [
  { name: 'Faces',      chars: ['😀','😄','😊','🙂','😉','😍','🤔','😎','😅','😢','😡','🥳','😴','🤓','🥰','😋'] },
  { name: 'Learning',   chars: ['📚','📖','✏️','📝','🖊️','📐','📏','🧮','🔬','🔭','🧪','🧫','🎓','🏫','📓','📔'] },
  { name: 'Symbols',    chars: ['⭐','✅','❌','❗','❓','💡','🔔','🎯','📌','📍','🎉','🏆','💯','✨','⚡','🔥'] },
  { name: 'Nature',     chars: ['🌳','🌲','🌿','🌷','🌸','🌼','☀️','🌙','⭐','🌍','🌎','🌏','🌊','🍀','🐝','🦋'] },
  { name: 'Activities', chars: ['⚽','🏀','🎨','🎭','🎵','🎸','🎮','🧩','🎲','🚴','🏃','🏊','🎒','✈️','🚀','🗺️'] },
  { name: 'Food',       chars: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🍞','🧀','🍪'] },
];

const SYMBOLS = [
  '×','÷','±','≈','≠','≤','≥','∞','π','√','∑','∏','∫','∂','∆',
  '°','′','″','‰','%','‹','›','«','»','–','—','…','·','•','§',
  '←','→','↑','↓','↔','⇐','⇒','⇑','⇓','⇔','★','☆','♥','♦','♣','♠',
  '€','£','¥','¢','©','®','™','†','‡','¶',
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<
    | null
    | 'block' | 'font' | 'size'
    | 'textColor' | 'highlight'
    | 'emoji' | 'symbol'
  >(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  // Selection gets lost when the dialog input takes focus — save it on open
  // and restore it before exec so the link wraps the originally-selected text.
  const savedRangeRef = useRef<Range | null>(null);

  // One-way sync: server value → DOM. Skip when the editor is focussed.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  // Close popovers when clicking outside the toolbar.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const root = (e.currentTarget as Document).querySelector('[data-rte-root]');
      if (root && !root.contains(target)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  /**
   * On paste, if the clipboard carries plain text that looks like
   * markdown, convert it to HTML and insert that instead. If the
   * clipboard already has rich HTML (a real webpage copy, etc.) we
   * leave the default paste behaviour alone so the original formatting
   * is preserved.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const clip = e.clipboardData;
    if (!clip) return;
    const htmlPayload = clip.getData('text/html');
    if (htmlPayload && htmlPayload.trim().length > 0) return;
    const text = clip.getData('text/plain');
    if (!text || !looksLikeMarkdown(text)) return;
    e.preventDefault();
    const parsed = marked.parse(text);
    // marked.parse can return a Promise when async extensions are
    // registered. We don't use any, so it's synchronous here — but
    // guard against the typing just in case.
    if (typeof parsed !== 'string') return;
    const safe = sanitiseMarkdownHtml(parsed);
    document.execCommand('insertHTML', false, safe);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function applyBlock(tag: BlockTag) {
    exec('formatBlock', tag);
    setOpenMenu(null);
  }

  function applyFont(family: string) {
    exec('fontName', family);
    setOpenMenu(null);
  }

  function applySize(size: string) {
    exec('fontSize', size);
    setOpenMenu(null);
  }

  function applyColor(kind: 'textColor' | 'highlight', color: string) {
    if (kind === 'textColor') exec('foreColor', color);
    else exec('hiliteColor', color); // some browsers use backColor
    setOpenMenu(null);
  }

  function openLinkDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
    setLinkDialogOpen(true);
  }

  function insertLink(url: string) {
    setLinkDialogOpen(false);
    // Restore the selection captured when the dialog opened, then exec.
    if (savedRangeRef.current && ref.current) {
      ref.current.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
    document.execCommand('createLink', false, url);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function insertHTML(html: string) {
    exec('insertHTML', html);
    setOpenMenu(null);
  }

  function clearFormatting() {
    exec('removeFormat');
    // removeFormat doesn't strip block tags; re-set to plain paragraph too.
    exec('formatBlock', 'P');
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white" data-rte-root>
      {/* Toolbar */}
      <div className="rte-toolbar flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
        {/* Block format */}
        <ToolbarSelect
          icon={<Type className="w-3.5 h-3.5" />}
          label="Format"
          open={openMenu === 'block'}
          onToggle={() => setOpenMenu(openMenu === 'block' ? null : 'block')}
        >
          {BLOCK_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} onClick={() => applyBlock(opt.value)}>
              {opt.label}
            </MenuItem>
          ))}
        </ToolbarSelect>

        {/* Font family */}
        <ToolbarSelect
          label="Font"
          open={openMenu === 'font'}
          onToggle={() => setOpenMenu(openMenu === 'font' ? null : 'font')}
        >
          {FONT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} onClick={() => applyFont(opt.value)}>
              <span style={{ fontFamily: opt.value }}>{opt.label}</span>
            </MenuItem>
          ))}
        </ToolbarSelect>

        {/* Font size */}
        <ToolbarSelect
          label="Size"
          open={openMenu === 'size'}
          onToggle={() => setOpenMenu(openMenu === 'size' ? null : 'size')}
        >
          {SIZE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} onClick={() => applySize(opt.value)}>
              {opt.label}
            </MenuItem>
          ))}
        </ToolbarSelect>

        <Divider />

        <ToolbarButton onClick={() => exec('bold')} ariaLabel="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} ariaLabel="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} ariaLabel="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('strikeThrough')} ariaLabel="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolbarButton>

        {/* Text color */}
        <ToolbarPopover
          icon={<Palette className="w-3.5 h-3.5" />}
          ariaLabel="Text color"
          open={openMenu === 'textColor'}
          onToggle={() => setOpenMenu(openMenu === 'textColor' ? null : 'textColor')}
        >
          <ColorGrid onPick={(c) => applyColor('textColor', c)} />
        </ToolbarPopover>

        {/* Highlight */}
        <ToolbarPopover
          icon={
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] font-bold rounded-sm bg-yellow-200 text-slate-800">A</span>
          }
          ariaLabel="Highlight color"
          open={openMenu === 'highlight'}
          onToggle={() => setOpenMenu(openMenu === 'highlight' ? null : 'highlight')}
        >
          <ColorGrid onPick={(c) => applyColor('highlight', c)} />
        </ToolbarPopover>

        <Divider />

        <ToolbarButton onClick={() => exec('justifyLeft')} ariaLabel="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyCenter')} ariaLabel="Align center"><AlignCenter className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyRight')} ariaLabel="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyFull')} ariaLabel="Justify"><AlignJustify className="w-3.5 h-3.5" /></ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => exec('insertUnorderedList')} ariaLabel="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} ariaLabel="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('outdent')} ariaLabel="Decrease indent"><Outdent className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('indent')} ariaLabel="Increase indent"><Indent className="w-3.5 h-3.5" /></ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => exec('insertHorizontalRule')} ariaLabel="Divider"><Minus className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={openLinkDialog} ariaLabel="Link"><LinkIcon className="w-3.5 h-3.5" /></ToolbarButton>

        {/* Emoji picker */}
        <ToolbarPopover
          icon={<Smile className="w-3.5 h-3.5" />}
          ariaLabel="Insert emoji"
          open={openMenu === 'emoji'}
          onToggle={() => setOpenMenu(openMenu === 'emoji' ? null : 'emoji')}
          wide
        >
          <EmojiGrid onPick={(e) => insertHTML(e)} />
        </ToolbarPopover>

        {/* Symbol picker */}
        <ToolbarPopover
          icon={<Sigma className="w-3.5 h-3.5" />}
          ariaLabel="Insert symbol"
          open={openMenu === 'symbol'}
          onToggle={() => setOpenMenu(openMenu === 'symbol' ? null : 'symbol')}
          wide
        >
          <SymbolGrid onPick={(s) => insertHTML(s)} />
        </ToolbarPopover>

        <Divider />

        <ToolbarButton onClick={clearFormatting} ariaLabel="Clear formatting"><Eraser className="w-3.5 h-3.5" /></ToolbarButton>
      </div>

      {/* Editable surface */}
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="rte-content min-h-[42rem] px-4 py-3 text-sm text-slate-800 focus:outline-none"
        data-placeholder={placeholder || ''}
        suppressContentEditableWarning
      />

      <LinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSubmit={insertLink}
      />
    </div>
  );
}

// ── Link dialog ───────────────────────────────────────────────────────────

function LinkDialog({
  open, onClose, onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const t = useTranslations('Lessons');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state each time the dialog opens, and focus the input.
  useEffect(() => {
    if (!open) return;
    setUrl('');
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError(t('linkDialogRequired'));
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setError(t('linkDialogInvalidScheme'));
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('linkDialogTitle')}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {t('completionCancel')}
          </button>
          <Button onClick={handleSubmit}>{t('linkDialogInsert')}</Button>
        </>
      }
    >
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">
          {t('linkDialogUrlLabel')}
          <span className="text-red-500 ml-0.5">*</span>
        </span>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
          }}
          placeholder={t('linkDialogUrlPlaceholder')}
          className={`w-full text-sm rounded-lg border px-3 py-2 focus:outline-none ${
            error
              ? 'border-red-500 focus:border-red-500 bg-red-50'
              : 'border-slate-200 focus:border-primary'
          }`}
        />
        {error && (
          <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">{t('linkDialogHint')}</p>
      </label>
    </Modal>
  );
}

// ── Toolbar primitives ─────────────────────────────────────────────────────

function Divider() {
  return <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden />;
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
      // onMouseDown so the editor's selection isn't lost when the button takes focus.
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  icon, label, open, onToggle, children,
}: {
  icon?: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onToggle(); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
      >
        {icon}
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 z-20 min-w-[10rem] rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {children}
        </div>
      )}
    </div>
  );
}

function ToolbarPopover({
  icon, ariaLabel, open, onToggle, children, wide,
}: {
  icon: React.ReactNode;
  ariaLabel: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onToggle(); }}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-800"
      >
        {icon}
      </button>
      {open && (
        <div
          role="dialog"
          className={`absolute left-0 top-full mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg p-2 ${wide ? 'w-72' : ''}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function ColorGrid({ onPick }: { onPick: (color: string) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1 w-44">
      {COLOR_SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
          aria-label={`Color ${c}`}
          className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform"
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {EMOJI_GROUPS.map((group) => (
        <div key={group.name}>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">{group.name}</p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.chars.map((char) => (
              <button
                key={char}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(char); }}
                className="w-7 h-7 rounded text-lg leading-none hover:bg-slate-100"
                aria-label={`Insert ${char}`}
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SymbolGrid({ onPick }: { onPick: (symbol: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5 max-h-72 overflow-y-auto">
      {SYMBOLS.map((s) => (
        <button
          key={s}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
          className="w-7 h-7 rounded text-base text-slate-700 hover:bg-slate-100"
          aria-label={`Insert ${s}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
