import { vi } from "vitest";

/**
 * Points `window.matchMedia` at a fixed viewport for a test.
 *
 * The global setup polyfills `matchMedia` so every query reports `matches: false`, i.e. the
 * narrowest layout. Components that branch on width via `useMediaQuery` (the pool, for one, which
 * only offers its cloud view from `sm` up) then render their mobile path. Call this from a test's
 * `beforeEach` to pin a `min-width` query result instead.
 *
 * `desktop` (the default) matches every `min-width` query, so width-gated desktop UI renders.
 */
export function mockViewport(desktop = true): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: desktop && query.includes("min-width"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
