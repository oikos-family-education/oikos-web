import { describe, it, expect } from 'vitest';
import { getServiceMeta } from '../../lib/getServiceMeta';

describe('getServiceMeta', () => {
  it('identifies YouTube', () => {
    expect(getServiceMeta('https://www.youtube.com/watch?v=abc').label).toBe('YouTube');
    expect(getServiceMeta('https://youtu.be/abc').label).toBe('YouTube');
  });

  it('identifies Google Drive / Docs', () => {
    expect(getServiceMeta('https://drive.google.com/file/123').label).toBe('Google Drive');
    expect(getServiceMeta('https://docs.google.com/document/d/abc').label).toBe('Google Drive');
  });

  it('identifies Amazon', () => {
    expect(getServiceMeta('https://www.amazon.com/dp/B00ABCDEF').label).toBe('Amazon');
    expect(getServiceMeta('https://amzn.to/3xyz').label).toBe('Amazon');
  });

  it('identifies Khan Academy', () => {
    expect(getServiceMeta('https://www.khanacademy.org/math').label).toBe('Khan Academy');
  });

  it('identifies Notion', () => {
    expect(getServiceMeta('https://www.notion.so/page').label).toBe('Notion');
  });

  it('identifies Internet Archive', () => {
    expect(getServiceMeta('https://archive.org/details/foo').label).toBe('Internet Archive');
  });

  it('falls back to Link for unknown URLs', () => {
    expect(getServiceMeta('https://example.com/page').label).toBe('Link');
    expect(getServiceMeta('https://random-site.io').label).toBe('Link');
  });

  it('falls back to Link for invalid/empty URL', () => {
    expect(getServiceMeta('not-a-url').label).toBe('Link');
    expect(getServiceMeta('').label).toBe('Link');
  });

  it('strips www. before matching', () => {
    expect(getServiceMeta('https://www.youtube.com/watch').label).toBe('YouTube');
  });

  it('returns an icon (not null) for every service', () => {
    const urls = [
      'https://youtube.com',
      'https://drive.google.com',
      'https://amazon.com',
      'https://vimeo.com',
      'https://spotify.com',
      'https://khanacademy.org',
      'https://archive.org',
      'https://notion.so',
      'https://unknown.example.com',
    ];
    for (const url of urls) {
      expect(getServiceMeta(url).icon).not.toBeNull();
    }
  });
});
