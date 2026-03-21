import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('Home');
  const tAuth = useTranslations('Auth');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 z-10 relative">
      <div className="text-center space-y-8 max-w-2xl bg-white/70 p-12 md:p-16 rounded-[2.5rem] shadow-2xl backdrop-blur-xl border border-white">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center rotate-3 hover:rotate-6 transition-transform">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-400 pb-2">
          {t('title')}
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed">
          {t('description')}
        </p>
        <div className="pt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/login" className="px-8 py-3.5 rounded-2xl bg-primary text-white font-semibold text-lg hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95">
            {tAuth('login')}
          </Link>
          <Link href="/register" className="px-8 py-3.5 rounded-2xl bg-white text-slate-700 border border-slate-200 font-semibold text-lg hover:border-primary hover:text-primary transition-all transform hover:-translate-y-1 active:scale-95 shadow-sm">
            {tAuth('register')}
          </Link>
        </div>
      </div>
    </main>
  );
}
