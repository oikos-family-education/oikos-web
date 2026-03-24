'use client';

import React, { useState } from 'react';
import { AuthProvider } from '../../../providers/AuthProvider';
import { Sidebar } from '../../../components/dashboard/Sidebar';
import { TopBar } from '../../../components/dashboard/TopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="flex h-screen bg-background relative z-10">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
