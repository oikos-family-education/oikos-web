'use client';

import React from 'react';

interface WidgetCardProps {
  title: string;
  /** Right-aligned action area (links, buttons). */
  actions?: React.ReactNode;
  /** Section description below the title. */
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}

export function WidgetCard({ title, actions, subtitle, className = '', children }: WidgetCardProps) {
  return (
    <section
      className={`bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-800 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

interface WidgetErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function WidgetError({ message, onRetry }: WidgetErrorProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
      <p className="text-xs text-slate-600">{message || 'Could not load this section.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
        >
          Try again
        </button>
      )}
    </div>
  );
}

interface WidgetEmptyProps {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  cta?: React.ReactNode;
}

export function WidgetEmpty({ icon, title, hint, cta }: WidgetEmptyProps) {
  return (
    <div className="text-center py-6">
      {icon && <div className="mx-auto mb-2 flex justify-center text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
