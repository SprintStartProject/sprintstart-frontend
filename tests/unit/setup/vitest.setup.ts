import '@testing-library/jest-dom';
import React from 'react';
import { vi, beforeAll, afterAll, afterEach, expect } from 'vitest';
import type { ReactNode } from 'react';
import * as matchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

declare module 'vitest' {
  export interface Assertion<T = any> extends matchers.AxeMatchers {}
  export interface AsymmetricMatchersContaining extends matchers.AxeMatchers {}
}

expect.extend(matchers);
import { setupServer } from 'msw/node';
import { handlers } from './msw-handlers';

// ── MSW Server ──────────────────────────────────────────────
export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── Keycloak JS mock (external IAM SDK) ─────────────────────
// Prevents `new Keycloak(...)` in src/config/keycloak.ts from
// crashing and gives us a controllable singleton.
const mockKeycloakInstance = {
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(true),
    authenticated: true,
    token: 'test-token',
};
vi.mock('keycloak-js', () => ({
    default: function () { return mockKeycloakInstance; },
}));

// Re-export so tests can configure the mock per-scenario
export { mockKeycloakInstance };

// 1. Mock Keycloak Context (Isolates IAM Layer)
vi.mock('@keycloakify/react', () => {
  return {
    useKeycloak: () => ({
      keycloak: {
        authenticated: true,
        token: 'mock-sprintstart-token',
        login: vi.fn(),
        logout: vi.fn(),
      },
      initialized: true,
    }),
  };
});

// 2. Mock React Router v7 (Handles Data Loaders and Application Boundaries)
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
  };
});

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
  };
});

// 3. Robust Mock for Framer Motion 12 (Prevents layout timeouts & layout clipping)
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  
  // Any tag, resolved on demand. This used to be a hand-maintained list, which
  // meant every new `motion.<tag>` in the app rendered `undefined` and took a
  // whole test file down with an unhelpful "Element type is invalid" -- with
  // nothing pointing at the list as the cause. A proxy cannot fall behind.
  //
  // Motion-only props are dropped rather than forwarded, so they do not reach
  // the DOM and trigger "React does not recognize the prop" warnings.
  const MOTION_ONLY_PROPS = new Set([
    'initial',
    'animate',
    'exit',
    'variants',
    'transition',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileDrag',
    'whileInView',
    'layout',
    'layoutId',
    'layoutScroll',
    'custom',
    'onHoverStart',
    'onHoverEnd',
    'onAnimationComplete',
    'drag',
  ]);

  // Cached per tag: the proxy must hand back the *same* component every time.
  // A fresh function on each access is a new element type to React, so it tears
  // the subtree down and rebuilds it on every render -- which detaches any DOM
  // node a test is holding on to, and its attributes then silently stop
  // updating.
  const componentCache = new Map<string, React.ComponentType<any>>();

  const mockedMotion = new Proxy(
    {},
    {
      get: (_target, tagName) => {
        if (typeof tagName !== 'string') return undefined;

        const cached = componentCache.get(tagName);
        if (cached) return cached;

        const Component = ({
          children,
          layoutId,
          ...props
        }: {
          children?: ReactNode;
          layoutId?: string;
          [key: string]: unknown;
        }) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !MOTION_ONLY_PROPS.has(key)),
          );

          // Surfaced as an attribute rather than dropped: which shared-layout
          // element a node belongs to is real behaviour worth asserting on, and
          // `layoutId` itself would trip React's unknown-prop warning.
          if (typeof layoutId === 'string') {
            domProps['data-layout-id'] = layoutId;
          }

          return React.createElement(tagName, domProps, children);
        };

        componentCache.set(tagName, Component);
        return Component;
      },
    },
  ) as Record<string, React.ComponentType<any>>;

  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: mockedMotion,
  };
});

// 4. Global Browser Polyfills
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// IntersectionObserver polyfill for jsdom (used by the chat auto-scroll logic).
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;


// matchMedia polyfill for jsdom (ThemeProvider listens to prefers-color-scheme
// changes when the user picks the 'system' theme). Tests can override per-case
// via Object.defineProperty(window, 'matchMedia', ...) if they need a specific
// matches value.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
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

if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function() {};
}
