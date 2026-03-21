import { BookOpen } from 'lucide-react';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal header with logo only */}
      <header className="py-6 px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">Oikos</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-3xl">
          {children}
        </div>
      </main>
    </div>
  );
}
