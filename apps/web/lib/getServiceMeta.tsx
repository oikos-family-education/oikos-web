import React from 'react';
import { Youtube, Archive, Link2 } from 'lucide-react';

interface ServiceMeta {
  label: string;
  icon: React.ReactNode;
}

const ICON_CLASS = 'w-4 h-4';

function BrandIcon({ path, viewBox = '0 0 24 24', color }: { path: string; viewBox?: string; color: string }) {
  return (
    <svg className={ICON_CLASS} viewBox={viewBox} fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d={path} />
    </svg>
  );
}

const GOOGLE_DRIVE_PATH =
  'M7.71 3.5L1.15 15l3.43 6 6.55-11.5L7.71 3.5zM22.85 15L16.29 3.5H9.14l6.56 11.5h7.15zM8.57 15.5l-3.43 6h13.72l3.43-6H8.57z';

const AMAZON_PATH =
  'M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685zm3.186 7.705a.66.66 0 01-.753.074c-1.057-.878-1.247-1.287-1.826-2.124-1.747 1.782-2.983 2.315-5.244 2.315-2.676 0-4.76-1.652-4.76-4.955 0-2.58 1.397-4.335 3.387-5.193 1.724-.758 4.132-.893 5.973-1.101v-.41c0-.758.058-1.652-.387-2.306-.387-.579-1.128-.819-1.782-.819-1.211 0-2.29.622-2.554 1.91-.054.285-.263.567-.551.581l-3.083-.333c-.26-.058-.548-.266-.474-.66C5.736 1.693 9.163.508 12.244.508c1.537 0 3.544.41 4.757 1.573 1.537 1.438 1.39 3.351 1.39 5.437v4.923c0 1.48.614 2.129 1.191 2.929.202.285.247.624-.011.835-.645.539-1.791 1.541-2.421 2.104l-.006-.005zM21.894 19.47c-2.396 1.808-5.873 2.772-8.865 2.772-4.196 0-7.975-1.55-10.831-4.132-.224-.202-.024-.479.247-.322 3.083 1.793 6.896 2.872 10.831 2.872 2.656 0 5.573-.551 8.258-1.693.405-.173.743.267.36.503z';

const VIMEO_PATH =
  'M22.875 7.8c-.1 2.1-1.6 5-4.4 8.6C15.5 20 13 21.8 10.9 21.8c-1.3 0-2.4-1.2-3.1-3.6-.6-2.1-1.1-4.2-1.7-6.3-.6-2.4-1.3-3.6-2.1-3.6-.2 0-.7.3-1.6.9L1.5 8l3-2.7c1.4-1.2 2.4-1.8 3.1-1.9 1.6-.2 2.6 1 3 3.4.4 2.6.7 4.3.9 5 .5 2.3 1 3.4 1.7 3.4.5 0 1.2-.8 2.1-2.3.9-1.5 1.4-2.7 1.5-3.5.1-1.4-.4-2.1-1.6-2.1-.6 0-1.1.1-1.7.4 1.1-3.7 3.3-5.5 6.4-5.4 2.3.1 3.4 1.6 3.2 4.5z';

const SPOTIFY_PATH =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';

const KHAN_PATH =
  'M21.724 4.973L13.418.328a3.214 3.214 0 00-2.828 0L2.276 4.973A3.05 3.05 0 00.862 7.371v9.256a3.05 3.05 0 001.414 2.4l8.306 4.645a3.214 3.214 0 002.828 0l8.306-4.645a3.05 3.05 0 001.414-2.4V7.373a3.05 3.05 0 00-1.406-2.4zM12 17.725a5.725 5.725 0 110-11.45 5.725 5.725 0 010 11.45z';

const NOTION_PATH =
  'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.103 2.1c-.42-.326-.98-.7-2.055-.607L3.01 2.676c-.466.046-.56.28-.373.466l1.822 1.066zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm14.337.746c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V8.755L7.833 8.62c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933l3.222-.187z';

const SERVICE_MAP: Array<{ patterns: string[]; label: string; icon: React.ReactNode }> = [
  {
    patterns: ['youtube.com', 'youtu.be'],
    label: 'YouTube',
    icon: <Youtube className={ICON_CLASS} />,
  },
  {
    patterns: ['drive.google.com', 'docs.google.com'],
    label: 'Google Drive',
    icon: <BrandIcon path={GOOGLE_DRIVE_PATH} color="#4285F4" />,
  },
  {
    patterns: ['amazon.com', 'amzn.to'],
    label: 'Amazon',
    icon: <BrandIcon path={AMAZON_PATH} color="#FF9900" viewBox="0 0 24 24" />,
  },
  {
    patterns: ['vimeo.com'],
    label: 'Vimeo',
    icon: <BrandIcon path={VIMEO_PATH} color="#1AB7EA" />,
  },
  {
    patterns: ['spotify.com'],
    label: 'Spotify',
    icon: <BrandIcon path={SPOTIFY_PATH} color="#1DB954" />,
  },
  {
    patterns: ['khanacademy.org'],
    label: 'Khan Academy',
    icon: <BrandIcon path={KHAN_PATH} color="#14BF96" />,
  },
  {
    patterns: ['archive.org'],
    label: 'Internet Archive',
    icon: <Archive className={ICON_CLASS} />,
  },
  {
    patterns: ['notion.so', 'notionso.com'],
    label: 'Notion',
    icon: <BrandIcon path={NOTION_PATH} color="#000000" />,
  },
];

export function getServiceMeta(url: string): ServiceMeta {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const service of SERVICE_MAP) {
      if (service.patterns.some((p) => hostname === p || hostname.endsWith('.' + p))) {
        return { label: service.label, icon: service.icon };
      }
    }
  } catch {
    // invalid URL
  }
  return { label: 'Link', icon: <Link2 className={ICON_CLASS} /> };
}
