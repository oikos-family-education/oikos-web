import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';

export const locales = ['en'];

export default getRequestConfig(async (context) => {
  const locale = (context as any).locale || (await (context as any).requestLocale);
  if (!locales.includes(locale as any)) notFound();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
