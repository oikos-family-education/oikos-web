import React from 'react';
import { CloudOnlyRouteGuard } from '@/components/desktop/CloudOnlyRouteGuard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CloudOnlyRouteGuard>{children}</CloudOnlyRouteGuard>;
}
