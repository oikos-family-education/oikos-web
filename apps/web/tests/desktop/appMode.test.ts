import { describe, it, expect, afterEach, vi } from 'vitest';
import { isDesktop } from '../../lib/appMode';

describe('isDesktop', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('follows NEXT_PUBLIC_APP_MODE on every call', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'desktop');
    expect(isDesktop()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', '');
    expect(isDesktop()).toBe(false);
  });

  it('treats any other value as cloud', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'cloud');
    expect(isDesktop()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'Desktop');
    expect(isDesktop()).toBe(false);
  });
});
