'use client';

import React, { useState } from 'react';
import { Link } from '../../lib/navigation';
import { isDesktop } from '../../lib/appMode';
import { CloudOnlyDialog } from './CloudOnlyDialog';

interface BetaCtaProps {
  className?: string;
  children: React.ReactNode;
}

/** Closed-beta call to action: a link online, a "cloud only" popup in the desktop app. */
export function BetaCta({ className, children }: BetaCtaProps) {
  const [open, setOpen] = useState(false);

  if (!isDesktop()) {
    return (
      <Link href="/beta" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <CloudOnlyDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
