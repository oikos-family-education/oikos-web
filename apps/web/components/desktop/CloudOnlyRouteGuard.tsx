'use client';

import React from 'react';
import { isDesktop } from '../../lib/appMode';
import { CloudOnlyPage } from './CloudOnlyPage';

interface CloudOnlyRouteGuardProps {
  children: React.ReactNode;
}

/** Replaces cloud-only routes with the "available online" page in the desktop app. */
export function CloudOnlyRouteGuard({ children }: CloudOnlyRouteGuardProps) {
  if (isDesktop()) return <CloudOnlyPage />;
  return <>{children}</>;
}
