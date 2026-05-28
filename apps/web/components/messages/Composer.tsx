'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Send } from 'lucide-react';

const MAX_BODY = 4000;

interface Props {
  disabled?: boolean;
  disabledReason?: string | null;
  onSend: (body: string) => Promise<void> | void;
}

/**
 * Bottom-of-thread composer. Cmd/Ctrl+Enter sends; plain Enter is a newline.
 */
export function Composer({ disabled, disabledReason, onSend }: Props) {
  const t = useTranslations('Messages');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setBody('');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  if (disabled) {
    return (
      <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 text-sm text-slate-500 italic">
        {disabledReason || ''}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 p-3 bg-white">
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('composerPlaceholder')}
          rows={2}
          maxLength={MAX_BODY}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[44px] max-h-40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() || sending}
          className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all"
          aria-label={t('sendButton')}
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
        <span>{t('composerHint')}</span>
        <span>{body.length}/{MAX_BODY}</span>
      </div>
    </div>
  );
}
