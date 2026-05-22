import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // `react()` resolves against the root's Vite copy while vitest brings its own.
  // The Plugin types are nominally distinct between the two; cast away the duplicate-version friction.
  plugins: [react() as unknown as never],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Vitest picks up *.spec.ts by default. The Playwright E2E specs live in
    // ./e2e and must be excluded — they import @playwright/test, which would
    // crash inside jsdom.
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'providers/**/*.{ts,tsx}',
        'middleware.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.next/**',
        'tests/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
