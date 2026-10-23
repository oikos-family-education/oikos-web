/**
 * Build-time app mode. Any value other than `desktop` means the cloud app.
 *
 * Read on every call (and as a literal `process.env.NEXT_PUBLIC_APP_MODE`
 * access so Next can inline it in client bundles) so tests can use vi.stubEnv.
 */
export function isDesktop(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE === 'desktop';
}
