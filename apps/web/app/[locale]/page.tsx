import { Link } from '../../lib/navigation';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  Compass,
  Flame,
  GraduationCap,
  Heart,
  Lock,
  NotebookPen,
  Shield,
  Sparkles,
  Target,
  TreePine,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('Landing');

  return (
    <main className="relative z-10">
      {/* Top nav */}
      <header className="max-w-6xl mx-auto px-6 lg:px-8 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center group-hover:rotate-3 transition-transform">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-bold text-slate-800">Oikos</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-primary transition-colors">{t('navHowItWorks')}</a>
          <a href="#features" className="hover:text-primary transition-colors">{t('navFeatures')}</a>
          <a href="#open-source" className="hover:text-primary transition-colors">{t('navOpenSource')}</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-primary transition-colors"
          >
            {t('navSignIn')}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-md shadow-primary/20 transition-all transform hover:-translate-y-0.5"
          >
            {t('navStartFree')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 lg:pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {t('heroBadge')}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-800 leading-[1.05]">
              {t.rich('heroTitle', {
                highlight: (chunks) => (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-rose-400">
                    {chunks}
                  </span>
                ),
              })}
            </h1>
            <p className="text-lg lg:text-xl text-slate-600 leading-relaxed max-w-xl">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center whitespace-nowrap px-7 py-3.5 rounded-2xl bg-primary text-white font-semibold text-base hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95"
              >
                {t('heroCtaPrimary')}
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center whitespace-nowrap px-7 py-3.5 rounded-2xl bg-white text-slate-700 border border-slate-200 font-semibold text-base hover:border-primary hover:text-primary transition-all transform hover:-translate-y-1 active:scale-95 shadow-sm"
              >
                {t('heroCtaSecondary')}
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-sm text-slate-500">
              <li className="flex items-center gap-1.5"><Heart className="w-4 h-4 text-primary" />{t('heroTrust1')}</li>
              <li className="flex items-center gap-1.5"><Compass className="w-4 h-4 text-primary" />{t('heroTrust2')}</li>
              <li className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-primary" />{t('heroTrust3')}</li>
            </ul>
          </div>

          {/* Hero preview card */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary/20 via-rose-200/40 to-orange-200/40 rounded-[3rem] blur-2xl pointer-events-none"></div>
            <div className="relative bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] shadow-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('previewTodayDate')}</p>
                  <h3 className="text-xl font-bold text-slate-800 mt-0.5">{t('previewTodayTitle')}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shadow-md">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t('previewItem1')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('previewItem1Time')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-200">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t('previewItem2')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('previewItem2Time')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-200">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <TreePine className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t('previewItem3')}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t('previewItem3Time')}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 border border-orange-100">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{t('previewStreakLabel')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('previewStreakSub')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closed beta CTA */}
      <section id="closed-beta" className="max-w-5xl mx-auto px-6 lg:px-8 py-10">
        <div className="bg-gradient-to-br from-primary/10 via-rose-100/40 to-orange-100/40 border border-primary/20 rounded-[2.5rem] p-8 sm:p-12 text-center backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            {t('betaBadge')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            {t('betaHeading')}
          </h2>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto">{t('betaBody')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
            <Link
              href="/beta"
              className="inline-flex items-center justify-center whitespace-nowrap px-7 py-3.5 rounded-2xl bg-primary text-white font-semibold text-base hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              {t('betaCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-10 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{t('trustHeading')}</h2>
        <p className="text-slate-600 mt-3 max-w-2xl mx-auto">{t('trustSubheading')}</p>
        <ul className="flex flex-wrap justify-center gap-2 mt-6">
          {[
            t('useCaseHomeschool'),
            t('useCaseAfterschool'),
            t('useCaseHybrid'),
            t('useCaseWeekend'),
            t('useCaseSummer'),
            t('useCaseTutored'),
          ].map((label) => (
            <li
              key={label}
              className="px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur border border-slate-200 text-sm font-medium text-slate-700"
            >
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">{t('featuresKicker')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mt-3 tracking-tight">{t('featuresHeading')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard icon={<CalendarDays />} title={t('feature1Title')} body={t('feature1Body')} />
          <FeatureCard icon={<GraduationCap />} title={t('feature2Title')} body={t('feature2Body')} />
          <FeatureCard icon={<Target />} title={t('feature3Title')} body={t('feature3Body')} />
          <FeatureCard icon={<ClipboardList />} title={t('feature4Title')} body={t('feature4Body')} />
          <FeatureCard icon={<NotebookPen />} title={t('feature5Title')} body={t('feature5Body')} />
          <FeatureCard icon={<Calendar />} title={t('feature6Title')} body={t('feature6Body')} />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">{t('howKicker')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mt-3 tracking-tight">{t('howHeading')}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <StepCard step={1} icon={<Shield />} title={t('how1Title')} body={t('how1Body')} />
          <StepCard step={2} icon={<Users />} title={t('how2Title')} body={t('how2Body')} />
          <StepCard step={3} icon={<Calendar />} title={t('how3Title')} body={t('how3Body')} />
        </div>
      </section>

      {/* Values */}
      <section id="open-source" className="max-w-6xl mx-auto px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">{t('valuesKicker')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mt-3 tracking-tight">{t('valuesHeading')}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <ValueCard icon={<Lock />} title={t('value1Title')} body={t('value1Body')} />
          <ValueCard icon={<Heart />} title={t('value2Title')} body={t('value2Body')} />
          <ValueCard icon={<Compass />} title={t('value3Title')} body={t('value3Body')} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-8 py-20">
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-2xl p-10 sm:p-16 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">{t('finalKicker')}</p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-800 mt-3 tracking-tight">{t('finalHeading')}</h2>
          <p className="text-lg text-slate-600 mt-5 max-w-xl mx-auto">{t('finalBody')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-8">
            <Link
              href="/register"
              className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-2xl bg-primary text-white font-semibold text-base hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95"
            >
              {t('finalCtaPrimary')}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center whitespace-nowrap px-8 py-3.5 rounded-2xl bg-white text-slate-700 border border-slate-200 font-semibold text-base hover:border-primary hover:text-primary transition-all transform hover:-translate-y-1 active:scale-95 shadow-sm"
            >
              {t('finalCtaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 lg:px-8 py-12 border-t border-slate-200/60">
        <div className="grid md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <span className="text-lg font-bold text-slate-800">Oikos</span>
            </Link>
            <p className="text-slate-500">{t('footerTagline')}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-3">{t('footerProduct')}</p>
            <ul className="space-y-2 text-slate-500">
              <li><a href="#features" className="hover:text-primary">{t('footerFeatures')}</a></li>
              <li><a href="#how-it-works" className="hover:text-primary">{t('footerHowItWorks')}</a></li>
              <li><a href="#open-source" className="hover:text-primary">{t('footerCommunity')}</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-3">{t('footerCompany')}</p>
            <ul className="space-y-2 text-slate-500">
              <li><a href="#" className="hover:text-primary">{t('footerAbout')}</a></li>
              <li><a href="#" className="hover:text-primary">{t('footerGitHub')}</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-3">Legal</p>
            <ul className="space-y-2 text-slate-500">
              <li><a href="#" className="hover:text-primary">{t('footerPrivacy')}</a></li>
              <li><a href="#" className="hover:text-primary">{t('footerTerms')}</a></li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-10 text-center">{t('footerCopyright', { year: new Date().getFullYear() })}</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-white rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-4 [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-slate-600 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function StepCard({ step, icon, title, body }: { step: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-white rounded-2xl p-6 shadow-md relative">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
          {step}
        </span>
        <div className="text-primary [&>svg]:w-5 [&>svg]:h-5">{icon}</div>
      </div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-slate-600 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function ValueCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white/60 backdrop-blur border border-slate-200/60 rounded-2xl p-6">
      <div className="inline-flex p-3 rounded-2xl bg-rose-50 text-rose-500 mb-4 [&>svg]:w-6 [&>svg]:h-6">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="text-slate-600 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
