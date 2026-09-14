import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, two lanes (ADR-0009).
 *
 * `unit` is the fast lane — pure planner logic plus React. It runs on every
 * commit and carries the coverage gate.
 *
 * `rls` needs Docker and a running local Supabase instance, so it is kept out of
 * the inner loop. It still runs in CI and is mandatory before any PR touching a
 * policy (ADR-0004) — separated for speed, never optional.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        test: {
          name: 'rls',
          environment: 'node',
          include: ['supabase/tests/**/*.test.ts'],
          // Policy tests hit a real local Postgres; they are slower and must not
          // run in parallel against shared fixture rows.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Show fully-covered files too. A gate you cannot see is a gate you stop
      // trusting — and a file silently missing from this table is how a
      // threshold becomes vacuous without anyone noticing.
      skipFull: false,
      include: ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'src/app/layout.tsx', 'src/lib/db/types.ts'],
      // ⛔ These floors are a ratchet. They may only move UP.
      // The TDD guard hook (.claude/hooks/tdd-guard.sh) blocks any edit that
      // lowers one, and it compares every occurrence — not just the first.
      thresholdAutoUpdate: false,
      thresholds: {
        // The app shell: React and route handlers.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // The planner is pure and is the product claim (ADR-0008).
        'packages/planner/src/**': {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
      },
    },
  },
});
