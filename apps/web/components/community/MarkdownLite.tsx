'use client';

import React from 'react';

/**
 * Minimal markdown renderer for community forum content.
 *
 * Supports: bold (**), italic (*), inline code (`), links ([text](url)),
 * blockquotes (> ), unordered lists (- ), ordered lists (1. ), fenced code blocks,
 * paragraphs (blank line). HTML and other markdown are stripped.
 */

interface Props {
  source: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url);
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // inline code
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 rounded text-sm">$1</code>');
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // links — last so the URL isn't mangled
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    if (!isSafeUrl(url)) return `${label}`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary-hover">${label}</a>`;
  });
  return out;
}

function renderBlocks(source: string): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<pre class="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-sm"><code>${escapeHtml(buf.join('\n'))}</code></pre>`
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2));
        i++;
      }
      out.push(
        `<blockquote class="border-l-4 border-slate-200 pl-3 text-slate-600 italic my-2">${renderInline(buf.join(' '))}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc pl-5 my-2 space-y-1">${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push(`<ol class="list-decimal pl-5 my-2 space-y-1">${items.join('')}</ol>`);
      continue;
    }

    // Paragraph (collect until blank line)
    if (line.trim() === '') {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p class="my-2 leading-relaxed">${renderInline(buf.join(' '))}</p>`);
  }
  return out.join('');
}

export function MarkdownLite({ source }: Props) {
  const html = React.useMemo(() => renderBlocks(source || ''), [source]);
  return <div className="text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />;
}
