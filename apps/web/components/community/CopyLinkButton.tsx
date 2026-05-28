'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link as LinkIcon, Check } from 'lucide-react';

interface Props {
  /** Absolute or relative URL. Relative paths will be joined to window.location.origin at click time. */
  url: string;
  label?: string;
  className?: string;
}

export function CopyLinkButton({ url, label, className = '' }: Props) {
  const t = useTranslations('Community.forum.toolbar');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    const absolute = url.startsWith('http') || typeof window === 'undefined'
      ? url
      : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      /* fail silently */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label || t('copyLink')}
      aria-label={label || t('copyLink')}
      className={`inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <LinkIcon className="w-3.5 h-3.5" />}
      <span>{copied ? t('linkCopied') : (label || t('copyLink'))}</span>
    </button>
  );
}
