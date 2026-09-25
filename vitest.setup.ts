import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Global test setup for the `unit` project.
 *
 * Cleanup is explicit. Testing Library only auto-registers its `afterEach` when
 * Vitest globals are enabled, and we keep them off so every test file declares
 * what it imports. Without this, renders leak between tests in a file and
 * `getAllByRole` counts the previous test's DOM too — which fails loudly on a
 * list, and silently on almost everything else.
 *
 * Note what is deliberately NOT here: no global fake timer and no frozen system
 * clock. `packages/planner` is forbidden from reading the wall clock at all
 * (ADR-0008) — every function takes the date it needs as an argument — so a
 * global clock stub would paper over exactly the bug that rule exists to catch.
 */
afterEach(cleanup);

/**
 * jsdom has no layout, so it ships no `ResizeObserver`. A silent one stands in:
 * with no layout there is never a size to report. Behaviour that depends on
 * real sizes is covered in Playwright.
 */
class SilentResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = SilentResizeObserver;
