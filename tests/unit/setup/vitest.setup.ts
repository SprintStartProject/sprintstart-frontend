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
  
  // Dynamically map common HTML tags used with motion elements
  const commonPrimitives = [
    'div',
    'button',
    'span',
    'ul',
    'li',
    'section',
    'nav',
    'form',
    'label',
    'h1',
    'h2',
    'p',
  ];
  
  const mockedMotion = commonPrimitives.reduce((acc, tagName) => {
    acc[tagName] = ({ children, className, ...props }: { children?: ReactNode; className?: string; [key: string]: unknown }) =>
      React.createElement(tagName, { className, ...props }, children);
    return acc;
  }, {} as Record<string, React.ComponentType<any>>);

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

if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function() {};
}
