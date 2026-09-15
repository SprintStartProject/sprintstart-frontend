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

/**
 * Points `window.matchMedia` at a viewport that can *change*, and hands back the control that
 * changes it.
 *
 * {@link mockViewport} is fixed for the length of a test, which is enough for anything that only
 * reads the width. It is not enough for behaviour that belongs to the crossing itself — a rail
 * that has to put itself away when the column it was standing in stops fitting. jsdom never
 * resizes on its own, so the listeners `useMediaQuery` subscribes with have to be kept and
 * called.
 *
 * `setDesktop` flips every `min-width` query and notifies; wrap it in `act()`, since it is a
 * store update arriving from outside React. `restore` puts the global polyfill back — the
 * override outlives the test that set it.
 */
export function mockResizableViewport(desktop = true): {
  setDesktop: (next: boolean) => void;
  restore: () => void;
} {
  // Bound, because this is stored and handed back rather than called through `window` —
  // which is also what `matchMedia` needs in order to work once it has been put back.
  const original: typeof window.matchMedia = window.matchMedia.bind(window);
  const listeners = new Set<() => void>();
  let isDesktop = desktop;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: isDesktop && query.includes("min-width"),
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });

  // Arrow properties rather than methods: neither reads `this`, and a control meant to be pulled
  // off the object and passed to `act()` should not care whether it was.
  return {
    setDesktop: (next: boolean) => {
      isDesktop = next;
      // A copy: a listener that unsubscribes as it runs would otherwise change the set underneath
      // the loop.
      for (const listener of [...listeners]) listener();
    },
    restore: () => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    },
  };
}
