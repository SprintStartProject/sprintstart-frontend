# Frontend Testing Strategy

This document is the single place for testing in `sprintstart-frontend`: what to
test, where tests live, and how the test setup works.

> **Related docs**
>
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — system architecture (routing, services, state).
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) — coding rules, including accessibility labels and `data-testid` (§5).

---

## 1. Overview

| Area                | Tool                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Test runner         | **Vitest 4** (configured in `vite.config.ts` `test:` block)          |
| Component testing   | **@testing-library/react** + **@testing-library/user-event**         |
| DOM matchers        | **@testing-library/jest-dom**                                        |
| HTTP mocking        | **msw** ^2.14 (`setupServer` from `msw/node`)                        |
| Accessibility       | **vitest-axe** ^0.1 (axe-core assertions via `expect().toPassAxe()`) |
| Browser environment | **jsdom** ^29                                                        |

Coverage is not set up: there is no coverage provider (`@vitest/coverage-v8`) in
`package.json` and no `coverage` block in the Vitest config.

There are no end-to-end tests (no Playwright, no Cypress).

### What to test

- Services: the backend contract (URL, method, body) and the error paths.
- Business and permission logic: `AuthGuard`, the access policy.
- Hooks with real logic.
- Key page and component behavior. Not trivial markup.

When you change a component that has tests, update them in the same PR.

---

## 2. Commands

`npm run test` runs the whole suite once (no watch mode). `npm run unit` skips
`tests/unit/a11y/` and `npm run a11y` runs only that folder, because the axe scans
are the slow part. All scripts are listed in the
[README](../README.md#commands--scripts).

---

## 3. Test file organization

```
tests/
└── unit/
    ├── setup/                    # Shared test infrastructure
    │   ├── vitest.setup.ts       # Global setup (jest-dom, MSW, Keycloak mock, polyfills)
    │   ├── rtl.tsx               # render/renderHook with a fresh QueryClientProvider (§4)
    │   ├── test-utils.tsx        # renderWithProviders() + createMockProfile()
    │   ├── msw-handlers.ts       # Default MSW handlers (backend HTTP + SSE mocks)
    │   ├── projectContext.ts     # createProjectContextValue() for tests without ProjectProvider
    │   ├── matchMedia.ts         # mockViewport() to pin min-width media queries
    │   └── testing-library-react-dist.d.ts  # Types for the deep import in rtl.tsx
    ├── a11y/                     # Accessibility tests (*.a11y.test.tsx)
    ├── auth/                     # Permission/access-policy tests
    ├── components/               # Shared component tests
    ├── context/                  # Provider tests (AuthProvider, ThemeProvider)
    ├── features/                 # Feature-sliced tests (mirrors src/features/)
    ├── hooks/                    # Shared hook tests
    ├── pages/                    # Page-level tests (*.test.tsx + *.a11y.test.tsx)
    ├── router/                   # AuthGuard tests
    ├── services/                 # Service module tests (backend contracts, error paths)
    ├── styles/                   # Guard against class strings Prettier would break
    └── bootSplash.test.ts        # src/bootSplash.ts (the splash index.html paints)
```

`tests/unit/` mirrors the `src/` structure.

### File naming conventions

- `*.test.ts(x)` — unit/component/page tests
- `*.a11y.test.tsx` — accessibility tests (axe-core checks against rendered output)

---

## 4. Vitest configuration

Configured in [`vite.config.ts`](../vite.config.ts):

```typescript
test: {
  environment: "jsdom",
  globals: true, // describe/it/expect available globally
  setupFiles: "./tests/unit/setup/vitest.setup.ts",
  exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  testTimeout: 30000,
  alias: [
    {
      find: /^@testing-library\/react$/,
      replacement: fileURLToPath(new URL("./tests/unit/setup/rtl.tsx", import.meta.url)),
    },
  ],
}
```

`globals: true` means you don't need to import `describe`, `it`, `expect`, etc.

The `alias` routes every import of `@testing-library/react` through
[`tests/unit/setup/rtl.tsx`](../tests/unit/setup/rtl.tsx). Its `render` and
`renderHook` wrap the UI in a `QueryClientProvider` with a fresh client per test
(`retry: false`, `gcTime: 0`), so components that read through TanStack Query work
without any extra setup and no cache leaks into the next test. Keep the RegExp form
of the alias; the comment in `vite.config.ts` explains why a string key silently
does not match.

The 30 s `testTimeout` exists because axe scans of full pages are slow when many run
in parallel.

---

## 5. Global setup (`tests/unit/setup/vitest.setup.ts`)

Loaded once before all tests. Sets up:

1. **jest-dom** matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
2. **Testing Library timeout** — `configure({ asyncUtilTimeout: 10000 })`, so
   `findBy*` and `waitFor` wait up to 10 s instead of 1 s
3. **vitest-axe** matchers (`toPassAxe()` extension on `expect`)
4. **MSW server** — `setupServer(...handlers)`, with `beforeAll → server.listen`,
   `afterEach → server.resetHandlers`, `afterAll → server.close`
5. **Keycloak JS mock** — `vi.mock('keycloak-js', ...)` returns a controllable
   singleton (`mockKeycloakInstance`) with stubbed `init`/`login`/`logout`/`updateToken`
6. **React Router passthrough** — `react-router-dom` and `react-router` are mocked
   with their real exports, nothing is replaced (so `MemoryRouter` etc. work in tests)
7. **Framer Motion mock** — `motion` is a proxy that renders any `motion.<tag>` as a
   plain element of that tag and drops motion-only props (a `layoutId` is kept as
   `data-layout-id`). `AnimatePresence` passes its children through. Prevents layout
   timeouts and layout clipping in jsdom.
8. **Browser polyfills** — `ResizeObserver`, `IntersectionObserver`, `matchMedia`
   (always `matches: false`; use `mockViewport()` from `matchMedia.ts` for desktop
   layouts), `HTMLElement.prototype.scrollIntoView`, and the layout methods of
   `Range` (jsdom doesn't implement these)

---

## 6. Test utilities (`tests/unit/setup/test-utils.tsx`)

### `renderWithProviders(ui, options)`

Wraps a component in `MemoryRouter` + `ThemeProvider` before rendering with
Testing Library (and, through the alias in §4, in a `QueryClientProvider`). Accepts a
`route` option to set the initial URL:

```tsx
const { getByText } = renderWithProviders(<MyPage />, { route: "/team/123" });
```

### `createMockProfile(permissionGroup, overrides)`

Returns a fully-typed `UserProfile` for tests, defaulting to `PermissionGroup.USER`.
Spread `overrides` to customize fields:

```tsx
const admin = createMockProfile(PermissionGroup.ADMIN, { id: "admin-1" });
```

---

## 7. MSW — Mock Service Worker

[`tests/unit/setup/msw-handlers.ts`](../tests/unit/setup/msw-handlers.ts) defines
default HTTP handlers using `msw`'s `http.get` / `http.post` / `http.patch` etc.

- **Default handlers** cover the most common endpoints (e.g.
  `GET /api/v1/users/me` → returns `backendUser`).
- **SSE mocking** — the `sseStream(...events)` helper returns a `ReadableStream`
  that emits each event as `data: <event>\n\n` with a 5ms delay, matching the
  format `parseSSEStream` expects.
- **Per-test overrides** — call `server.use(http.get(...))` inside a test to
  override the default handler for that test only (auto-reset in `afterEach`).
- **Unhandled requests error** — `server.listen({ onUnhandledRequest: 'error' })`
  fails tests that make HTTP calls without a matching handler. This catches
  regressions where a service gains a new endpoint but no mock.

```tsx
import { http, HttpResponse } from 'msw';
import { server } from '../setup/vitest.setup';

it('returns the user profile', async () => {
  server.use(
    http.get('/api/v1/users/me', () => HttpResponse.json({ id: '42', ... }))
  );
  // ... test the service
});
```

The MSW server intercepts native `fetch()` calls, including those made by
`apiClient.fetch`.

---

## 8. Mock data (`src/mocks/`)

There is **no mock mode**. `npm run dev` always talks to the real backend at
`127.0.0.1:8080` and Keycloak at `127.0.0.1:8081` through the Vite dev proxy, so
both have to be running (see the README).

`src/mocks/` only holds two fixtures, both used by
`src/services/teamManagementService.ts`:

| File                    | Fallback in                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `teamOverviewMock.json` | `getTeamOverview`, `getProjectRoles`, `createProjectRole`, `assignProjectRoleToUser`, `unassignProjectRoleFromUser`, `deleteProjectRole` |
| `skillsMock.json`       | `getSkills`, `reactivateSkill`, `createSkill`, `deleteSkill`, `deleteProjectRole`                                                        |

These functions fall back to the fixtures when the backend request fails.
`hasCompletedSkillAssessment` and `saveUserSkillAssessments` fall back the same way,
but to an in-memory list of assessments that starts empty, not to a fixture. In all
of these cases the caller cannot tell the fallback from a success. Functions that
must not invent data, such as `getTeamOverviewOrThrow`, do not fall back.

### In tests

Use MSW handlers (§7) to control backend responses. Do not add new fixtures to
`src/mocks/` for tests, and do not add new service-level mock fallbacks.

---

## 9. A11y testing

Accessibility tests live under `tests/unit/a11y/`. They render a component with `renderWithProviders` and
assert the output passes axe-core checks:

```tsx
import { renderWithProviders } from "../setup/test-utils";
import { expect } from "vitest";
import { MyComponent } from "../../../src/features/.../MyComponent";

it("passes axe accessibility checks", async () => {
  const { container } = renderWithProviders(<MyComponent />);
  await expect(container).toPassAxe();
});
```

The `toPassAxe()` matcher is wired up in `vitest.setup.ts` via
`vitest-axe/extend-expect`. Targets **WCAG 2.1 AA**.
