# Frontend Testing Strategy

This document describes the actual testing setup for `sprintstart-frontend`. It
replaces the previous `mocking_strategy.md`, which described a Playwright + axios

- `cross-env` pipeline that does not match the current codebase.

> **Related docs**
>
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — system architecture (routing, services, state).
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) §8 — testing rules summary.

---

## 1. Overview

| Area                | Tool                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| Test runner         | **Vitest 4** (configured in `vite.config.ts` `test:` block)            |
| Component testing   | **@testing-library/react** + **@testing-library/user-event**           |
| DOM matchers        | **@testing-library/jest-dom**                                          |
| HTTP mocking        | **msw** ^2.14 (`setupServer` from `msw/node`)                          |
| Accessibility       | **vitest-axe** ^0.1 (axe-core assertions via `expect().toPassAxe()`)   |
| Browser environment | **jsdom** ^29                                                          |
| Coverage            | built-in Vitest coverage (configured via `vitest` in `vite.config.ts`) |

**What we do NOT use:**

- ❌ Playwright (the old `mocking_strategy.md` claimed we did — it was wrong)
- ❌ axios-mock-adapter (the old doc showed `axios.get` — the codebase uses native `fetch` via `apiClient`)
- ❌ `cross-env` (the old doc claimed mock mode is activated via `cross-env VITE_USE_MOCK_MODE=true vite` — actually it's activated via the `VITE_USE_MOCK_MODE` env var, which a dev can set in `.env.development`; see §8)

---

## 2. Commands

| Purpose                                                      | Command        |
| ------------------------------------------------------------ | -------------- |
| All unit tests (CI-friendly, non-watch)                      | `npm run test` |
| Unit tests only (excludes `tests/unit/a11y/**/*`)            | `npm run unit` |
| A11y tests only (`tests/unit/a11y/`)                         | `npm run a11y` |
| Full DoD verification (install + build + lint + unit + a11y) | `npm run try`  |

Scripts (from `package.json`):

```json
{
  "test": "vitest run",
  "unit": "vitest run --exclude 'tests/unit/a11y/**/*'",
  "a11y": "vitest run tests/unit/a11y/",
  "try": "npm install && npm run build && npm run lint && npm run unit && npm run a11y"
}
```

---

## 3. Test file organization

```
tests/
└── unit/
    ├── setup/                    # Shared test infrastructure
    │   ├── vitest.setup.ts       # Global setup (jest-dom, MSW, Keycloak mock, polyfills)
    │   ├── test-utils.tsx        # renderWithProviders() + createMockProfile()
    │   └── msw-handlers.ts       # Default MSW handlers (backend HTTP + SSE mocks)
    ├── a11y/                     # Accessibility tests (*.a11y.test.tsx)
    ├── auth/                     # Permission/access-policy tests
    ├── components/               # Shared component tests
    ├── context/                  # Provider tests (AuthProvider, ThemeProvider)
    ├── features/                 # Feature-sliced tests (mirrors src/features/)
    ├── hooks/                    # Shared hook tests
    ├── pages/                    # Page-level tests (*.test.tsx + *.a11y.test.tsx)
    ├── router/                   # AuthGuard tests
    └── services/                 # Service module tests (backend contracts, error paths)
```

`tests/unit/` mirrors `src/` structure. When you change a component, update its
tests in the same PR.

### File naming conventions

- `*.test.ts(x)` — unit/component/page tests
- `*.a11y.test.tsx` — accessibility tests (axe-core checks against rendered output)

---

## 4. Vitest configuration

Configured in [`vite.config.ts`](../vite.config.ts):

```typescript
test: {
  environment: 'jsdom',
  globals: true,                                          // describe/it/expect available globally
  setupFiles: './tests/unit/setup/vitest.setup.ts',
}
```

`globals: true` means you don't need to import `describe`, `it`, `expect`, etc.

---

## 5. Global setup (`tests/unit/setup/vitest.setup.ts`)

Loaded once before all tests. Sets up:

1. **jest-dom** matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
2. **vitest-axe** matchers (`toPassAxe()` extension on `expect`)
3. **MSW server** — `setupServer(...handlers)`, with `beforeAll → server.listen`,
   `afterEach → server.resetHandlers`, `afterAll → server.close`
4. **Keycloak JS mock** — `vi.mock('keycloak-js', ...)` returns a controllable
   singleton (`mockKeycloakInstance`) with stubbed `init`/`login`/`logout`/`updateToken`
5. **`@keycloakify/react` mock** — `useKeycloak()` returns a stubbed authenticated state
6. **React Router mock** — preserves the real `react-router-dom` and `react-router`
   exports (so `MemoryRouter` etc. work in tests)
7. **Framer Motion mock** — maps common HTML tags (`div`, `button`, `span`, …)
   to plain `React.createElement`, and stubs `AnimatePresence` to passthrough
   children. Prevents layout timeouts and layout clipping in jsdom.
8. **Browser polyfills** — `ResizeObserver`, `IntersectionObserver`, `matchMedia`,
   `HTMLElement.prototype.scrollIntoView` (jsdom doesn't implement these)

---

## 6. Test utilities (`tests/unit/setup/test-utils.tsx`)

### `renderWithProviders(ui, options)`

Wraps a component in `MemoryRouter` + `ThemeProvider` before rendering with
Testing Library. Accepts a `route` option to set the initial URL:

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

The MSW server intercepts native `fetch()` calls (including those made by
`apiClient.fetch`), so no axios-mock-adapter is needed.

---

## 8. Mock mode (`VITE_USE_MOCK_MODE`)

The codebase has a service-layer mock mode activated by the **environment
variable** `VITE_USE_MOCK_MODE=true`.

> [!NOTE]
> Mock mode is **opt-in**. The repo no longer ships a `.env.development` that
> sets it by default — a fresh clone's `npm run dev` will attempt to call the
> real backend at `127.0.0.1:8080` and Keycloak at `127.0.0.1:8081`. To enable
> mock mode, see "Enabling mock mode" below.

### How it works

Each service function checks the flag before initiating any external network
fetch:

```typescript
import { mockConversations } from "../mocks/chatMocks";

export async function fetchChatHistory(chatId: string): Promise<MessageDto[]> {
  if (import.meta.env.VITE_USE_MOCK_MODE === "true") {
    return mockConversations[chatId] ?? [];
  }
  // Standard backend fetch via apiClient
  return apiClient.fetch<MessageDto[]>(`/api/v1/chats/${chatId}`);
}
```

### Rationale

During local development or automated unit/a11y testing, backend components
(Keycloak, PostgreSQL, LLM services) may be unmerged or offline. Mock mode lets
the dev server and tests run without a live backend, returning mock DTOs from
`src/mocks/` instead of making real HTTP calls.

### Enabling mock mode

Pick whichever fits your workflow:

- **Per-dev persistent (recommended):** create `.env.development` (gitignored)
  in the repo root with one line:
  ```env
  VITE_USE_MOCK_MODE=true
  ```
  Vite auto-loads `.env.development` in `npm run dev` (mode = development), so
  mock mode stays on for every `npm run dev` without re-typing.
- **Per-shell (one-off):** set the env var before starting the dev server:
  ```powershell
  $env:VITE_USE_MOCK_MODE = "true"; npm run dev
  ```
  ```bash
  VITE_USE_MOCK_MODE=true npm run dev
  ```
- **Per-project (shared with your team):** add the line to `.env` (also
  gitignored) if you want it applied in every Vite mode, not just development.

### Disabling mock mode

- If you've set it in `.env.development` / `.env`, edit the file to
  `VITE_USE_MOCK_MODE=false` (or delete the file).
- For a single command, prefix with `false`:
  `$env:VITE_USE_MOCK_MODE = "false"; npm run dev`

### In tests

MSW is the preferred HTTP mocking layer (it intercepts at the `fetch` level, so
service code runs unchanged). Mock mode is mostly relevant for `npm run dev`
and `npm run storybook`.

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

Run a11y tests in isolation:

```bash
npm run a11y
```

---

## 10. Test doubles

| Concern             | Tool                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| Component rendering | `@testing-library/react` `render` / `renderWithProviders`                         |
| User interactions   | `@testing-library/user-event`                                                     |
| DOM matchers        | `@testing-library/jest-dom`                                                       |
| HTTP mocking        | `msw` (`setupServer`, `http.get/post/patch/...`)                                  |
| Browser environment | `jsdom`                                                                           |
| axe-core assertions | `vitest-axe` (`toPassAxe()`)                                                      |
| Module mocks        | Vitest `vi.mock()` / `vi.fn()`                                                    |
| React Router        | `MemoryRouter` from `react-router-dom` (real module, not mocked)                  |
| Framer Motion       | mocked in `vitest.setup.ts` (passthrough — prevents jsdom layout issues)          |
| Keycloak JS         | mocked in `vitest.setup.ts` (`mockKeycloakInstance` exported for per-test config) |

---

## 11. E2E hooks in component code

To support automated testing (and screen readers), interactive components must
declare:

- **`aria-label`** on buttons/links that contain only graphic icons.
- **`data-testid`** on key interactive items targeted by tests (role selections,
  chat submit buttons, etc.).

```tsx
/**
 * Menu toggle button. Contains only a Lucide icon, requiring
 * an aria-label for screen-reader compliance.
 */
<button onClick={toggleSidebar} aria-label="Toggle navigation menu" data-testid="sidebar-toggle">
  <MenuIcon />
</button>
```

These attributes are tested by the `jsx-a11y` ESLint plugin (compile-time) and
the a11y test suite (runtime).
