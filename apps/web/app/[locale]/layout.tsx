import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Oikos | Family Education",
  description: "Open Source Family Education Platform",
};

export default async function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        {/* Apply UI preferences before React hydrates to prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){try{
  var p=JSON.parse(localStorage.getItem('oikos:ui-prefs')||'{}');
  var h=document.documentElement;
  var theme=p.theme||'light';
  if(theme==='dark'){h.classList.add('dark');}
  if(p.font_size==='large'){h.classList.add('font-large');}
  else if(p.font_size==='xl'){h.classList.add('font-xl');}
  if(p.reduce_motion){h.classList.add('reduce-motion');}
  if(p.high_contrast){h.classList.add('high-contrast');}
  if(p.dyslexia_font){h.classList.add('dyslexia-font');}
}catch(e){}}());
        `}} />
      </head>
      <body className={`${inter.className} min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50 relative overflow-x-hidden`}>
        <NextIntlClientProvider messages={messages}>
          {/* Decorative background blobs */}
          <div className="absolute top-0 -left-4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
          <div className="absolute top-20 right-0 w-96 h-96 bg-rose-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 pointer-events-none"></div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
