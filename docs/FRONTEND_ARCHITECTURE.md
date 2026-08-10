# Frontend Architecture

This document is the authoritative architecture reference for `sprintstart-frontend`.
It replaces the frontend section of the (root-level) `ARCHITECTURE.md` so that this
repository is self-sufficient: a developer cloning only `sprintstart-frontend/` gets
the full architecture picture without needing root files.

> **Related docs**
>
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) — TS / React / Tailwind / a11y rules.
> - [FRONTEND_DOCUMENTATION_GUIDELINES.md](./FRONTEND_DOCUMENTATION_GUIDELINES.md) — TSDoc/JSDoc rules.
> - [testing_strategy.md](./testing_strategy.md) — Vitest + MSW + vitest-axe setup.
> - [../AGENTS.md](../AGENTS.md) — short-context orientation guide for AI agents.
> - [../README.md](../README.md) — setup, prerequisites, env vars, developer notes.

---

## 1. Overview

The frontend is a **React 19 single-page application (SPA)** serving the SprintStart
UI layer — onboarding wizards, an AI chat assistant, knowledge-base browsing, and
admin/team-management surfaces. It talks to a separate Kotlin backend (REST + SSE)
and uses **Keycloak** for identity and access management.

- **Feature-first architecture** — domain code lives in `src/features/<name>/`; only
  genuinely shared code lives in top-level folders.
- **React Router v7** with declarative `<Route element={...}>` + an `AuthGuard` wrapper.
- **Tailwind CSS v4** with a single shared semantic palette (light/dark themes).
- **Framer Motion 12** with centralized spring transition tokens.
- **Keycloakify 11** for a custom Keycloak login theme.

---

## 2. Tech stack

| Area                      | Technology                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| UI framework              | **React 19**                                                                                    |
| Routing                   | **React Router v7** (`react-router-dom` ^7)                                                     |
| Language                  | **TypeScript** (strict, `verbatimModuleSyntax`)                                                 |
| Build tooling             | **Vite 8**                                                                                      |
| Styling                   | **Tailwind CSS v4** (semantic design tokens, light/dark themes)                                 |
| Animation                 | **Framer Motion 12** (centralized spring tokens)                                                |
| Authentication            | **Keycloak** via `keycloak-js`, with a custom login theme built on **Keycloakify 11**           |
| Markdown / math rendering | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter`       |
| Icons                     | `lucide-react`                                                                                  |
| Avatars                   | `boring-avatars`                                                                                |
| Unit testing              | **Vitest 4** + **Testing Library** (`jsdom`, `msw`, `vitest-axe`)                               |
| Component dev             | **Storybook 10**                                                                                |
| Linting / formatting      | **ESLint 9** (flat config: `typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`, `prettier`) |

---

## 3. Source layout (`src/`)

Feature-first: domain code lives in `features/<name>/`; only genuinely shared code
goes in the top-level folders.

```
src/
├── features/            # Self-contained domain slices (components/, hooks/, types.ts)
│   ├── admin/               # User, project & token management
│   ├── chatbot/             # Streaming AI assistant
│   ├── connectors/          # Connector + source allow/deny management
│   ├── data-ingestion/      # Sources, ingestion runs, artifacts
│   ├── faq/                 # AI FAQ clusters (insights)
│   ├── knowledge-base/      # Artifact browsing + streamed summaries
│   ├── knowledge-gaps/      # AI-detected documentation gaps (insights)
│   ├── onboarding/          # AI onboarding paths, checks, skip workflow
│   ├── profile/             # User profile view/edit
│   ├── projects/            # Project selection
│   ├── settings/            # User settings (chat preferences, etc.)
│   └── team-management/     # Team overview, member detail, Skill Wizard
├── pages/               # Route-level views (one per user-facing flow)
├── router/              # AppRouter.tsx + AuthGuard.tsx
├── auth/                # accessPolicy.ts (AppRoute union + canAccessRoute)
├── context/             # Global providers (Auth, Theme, Chat, ChatPreferences)
├── services/            # Backend communication (one module per domain; SSE streaming)
├── components/          # Shared UI: common/, layout/, ui/ primitives
├── config/              # Integration config (keycloak.ts)
├── hooks/               # Shared hooks
├── styles/              # Global CSS (index.css) + animation tokens (tokens.ts)
├── mocks/               # Dev mock data
└── keycloak-theme/      # Keycloakify overrides (kc.gen.tsx is generated — do not hand-edit)
```

> **Note:** there is **no `src/types/` folder**. Global types live alongside their
> consumers (e.g. `src/services/types.ts` for backend DTOs, `src/auth/accessPolicy.ts`
> for routing types).

**Rule:** new feature work → a `features/<name>/` slice. Promote to `components/` or
`context/` only when the code is truly shared across features.

---

## 4. Routing & access control

The app uses React Router v7's **declarative `<Route element={...}>` API**, guarded
by an `AuthGuard` wrapper component. It does **not** use the data-router
`loader`/`action` APIs — there are no `LoaderFunctionArgs` or route loaders in the
codebase.

### 4.1 Router structure (`src/router/AppRouter.tsx`)

`AppRouter` renders a single `<AuthGuard>` wrapping a `<Routes>` block. Every
user-facing route is declared as a `<Route element={<Page />} />` entry. Auth is
handled by the wrapper, not per-route loaders.

### 4.2 AuthGuard (`src/router/AuthGuard.tsx`)

`AuthGuard` is the single entry point for access control. It:

1. Reads `status` (`loading` | `authenticated` | `unauthenticated`) and `profile`
   from `useAuth()`.
2. Redirects unauthenticated users to `/login` (preserving the original target via
   `location.state.from`).
3. Redirects authenticated users on `/login` back to where they came from.
4. Redirects authenticated users who need a skill assessment to `/skill-wizard`
   (the only route exempt from the skill-assessment gate).
5. Renders a full-screen spinner while auth state or skill-assessment check is in
   flight.

### 4.3 Access policy (`src/auth/accessPolicy.ts`)

Route-level authorization is centralized in `src/auth/accessPolicy.ts`:

- **`AppRoute` union** — every protected route literal (e.g. `'/'`, `'/chat'`,
  `'/admin'`, `'/pm-dashboard'`, `'/team-management'`, `'/insights/faq'`,
  `'/insights/knowledge-gaps'`).
- **`routePermissions`** — `Record<AppRoute, readonly PermissionGroup[]>` mapping
  each route to the groups allowed to access it.
- **`canAccessRoute(profile, route)`** — returns `true` if the user's
  `permissionGroup` is in the route's allow-list.
- **`getDefaultRoute(profile)`** — the route to redirect to after login.
- **`getMatchingProtectedRoute(pathname)`** — matches a real URL (including
  dynamic segments like `/team/:userId`) back to an `AppRoute` for permission
  checks.

**Four permission groups** (defined in `src/services/types.ts` as `PermissionGroup`):

| Group   | Intended for                                 |
| ------- | -------------------------------------------- |
| `USER`  | Regular onboarding users                     |
| `PM`    | Project managers (team overview, dashboards) |
| `HR`    | People ops (admin-style surfaces)            |
| `ADMIN` | Full system administration                   |

> **New protected routes must be added to `AppRoute` + `routePermissions`**, or they
> won't type-check and won't be access-controlled.

### 4.4 Actual route list

Declared in `AppRouter.tsx` (17 routes):

```
/login                          /team-management
/skill-wizard                   /team/:userId
/                               /pm-dashboard
/chat                           /admin
/chat/:id                       /insights/faq
/onboarding                     /insights/faq/:groupId
/onboarding/:stepId             /insights/knowledge-gaps
/knowledge-base                 /insights/knowledge-gaps/:gapId
/data-ingestion                 /profile
```

---

## 5. State management

There is **no global store** (no Redux, Zustand, etc.). Cross-cutting state is
handled by React Context providers in `src/context/`:

| Provider / hook                                  | File                                                                                | Responsibility                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `AuthProvider` + `useAuth`                       | `AuthProvider.tsx`, `AuthContext.ts`, `useAuth.ts`                                  | Initializes Keycloak, fetches the user profile (with retries), exposes `status` + `profile`. |
| `ThemeProvider` + `useTheme`                     | `ThemeProvider.tsx`, `ThemeContext.ts`, `useTheme.ts`                               | Light/dark/system theme via `.dark` class on `document.documentElement`; persists choice.    |
| `ChatProvider`                                   | `ChatProvider.tsx`, `ChatContext.ts`                                                | Active conversation state for the chatbot feature.                                           |
| `ChatPreferencesProvider` + `useChatPreferences` | `ChatPreferencesProvider.tsx`, `ChatPreferencesContext.ts`, `useChatPreferences.ts` | Per-user chat UI preferences.                                                                |

Feature-local state stays inside the feature (e.g. `onboarding` step state lives in
`features/onboarding/`).

---

## 6. API layer

### 6.1 `apiClient` (`src/services/apiClient.ts`)

The codebase uses the **native `fetch` API** (not axios). All HTTP calls go through
`apiClient.fetch<T>(endpoint, options)`, which:

- Refreshes the Keycloak JWT if it expires in <30s (`keycloak.updateToken(30)`).
- Injects `Authorization: Bearer <token>` header.
- Defaults `Content-Type` to `application/json` (unless body is `FormData`).
- Throws `ApiError` (with `.status`) on non-2xx responses; forces re-auth on 401.
- Parses JSON, returning `{}` for empty bodies.

### 6.2 SSE streaming (`src/services/sse.ts`)

`parseSSEStream<T>(stream)` is an async generator that:

- Reads a `ReadableStream<Uint8Array>` (from a `fetch` response body).
- Buffers partial lines across chunk boundaries.
- Yields each `data:` JSON payload as a typed object.
- Skips malformed `data:` lines (logs via `console.warn`) rather than aborting.

Used by `chatService`, `knowledgeService`, and `onboardingService` so the
line-splitting / JSON-parsing logic lives in exactly one place.

### 6.3 Service modules (`src/services/`)

One module per domain. Each exports typed functions and surfaces backend failures
(no empty `catch`, no silent swallow):

| Module                     | Domain                                                         |
| -------------------------- | -------------------------------------------------------------- |
| `adminUserService.ts`      | Admin user management                                          |
| `apiClient.ts`             | Shared fetch wrapper                                           |
| `chatService.ts`           | Chatbot (SSE streaming)                                        |
| `connectorService.ts`      | Connectors + source allow/deny lists                           |
| `faqService.ts`            | Insights FAQ clusters                                          |
| `ingestionService.ts`      | Data ingestion runs + artifacts                                |
| `knowledgeGapService.ts`   | Insights knowledge gaps                                        |
| `knowledgeService.ts`      | Knowledge base + streamed summaries                            |
| `onboardingService.ts`     | Onboarding paths, steps, tasks, feedback                       |
| `projectService.ts`        | Project selection                                              |
| `sse.ts`                   | Shared SSE stream parser                                       |
| `teamManagementService.ts` | Team overview, member detail, skills                           |
| `userService.ts`           | Current user profile                                           |
| `types.ts`                 | Backend DTO types (the closest thing to a global types folder) |
| `sources/`                 | Per-source services (e.g. `githubService`)                     |

### 6.4 Vite dev proxy (`vite.config.ts`)

| Path    | Target                             |
| ------- | ---------------------------------- |
| `/api`  | `http://127.0.0.1:8080` (backend)  |
| `/v1`   | `http://127.0.0.1:8080` (backend)  |
| `/auth` | `http://127.0.0.1:8081` (Keycloak) |

---

## 7. Design system

### 7.1 One shared palette

A set of **semantic design tokens** (CSS variables → Tailwind `app-*` classes)
defined in [`src/styles/index.css`](../src/styles/index.css). **Always use tokens;
never hardcode colors** (no `#2563eb`, no raw Tailwind colors like `text-blue-500`).

Semantic roles:

- **Surfaces**: `bg-app-bg`, `bg-app-surface`, `bg-app-surface-muted`
- **Text**: `text-app-text`, `text-app-text-muted`, `text-app-text-subtle`
- **Borders**: `border-app-border`, …
- **Brand**: `bg-app-brand`, `text-app-brand`, …
- **Status**: `success` / `warning` / `danger` / `neutral`
  (e.g. `bg-app-success-bg text-app-success-text`)

### 7.2 Light / dark theme

Controlled via the `.dark` class on `document.documentElement`, managed by
`ThemeProvider`. The entry CSS uses `@import "tailwindcss"`, `@custom-variant dark`,
and `@theme inline` to map CSS custom properties into Tailwind tokens. Every color
works in both themes automatically when you use tokens.

### 7.3 Color-blind accessibility (required)

Never rely on color **alone** to convey meaning. Always back it with an
**icon, text label, or shape** (e.g. status = chip text + icon, not just red/green)
— this is why finished/skipped/locked steps use distinct icons _and_ labels. Keep
color pairs distinguishable for common color-vision deficiencies.

### 7.4 Contrast & focus

- Meet **WCAG 2.1 AA** for text and interactive elements.
- Keep visible focus via the `--app-focus` token (`focus-visible:ring-app-focus`) —
  don't remove outlines.

### 7.5 Stay consistent beyond color

Use the shared Tailwind scale for spacing, radius, and sizing instead of arbitrary
one-off pixel values, so padding/margins/gaps match the rest of the app.

---

## 8. Animation system (Framer Motion 12)

The codebase consumes `framer-motion` (^12) directly with inline `motion.` props.

### 8.1 Centralized spring tokens

Canonical implementation: [`src/styles/tokens.ts`](../src/styles/tokens.ts).

```typescript
import type { Transition } from "framer-motion";

/** Default spring for layout transitions, list enter/exit, and general motion.
 *  Snappy but not stiff — settles quickly without overshooting violently. */
export const centralSpringToken: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
  mass: 0.8,
};

/** Lighter spring for hover/tap micro-interactions — faster, slightly bouncier. */
export const hoverSpringToken: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 15,
};
```

**Rule:** use these presets for ALL `motion` transitions — do not inline ad-hoc
spring configs.

Usage:

```tsx
import { centralSpringToken } from "@/styles/tokens";
<motion.div transition={centralSpringToken} ... />
```

### 8.2 Layout transitions & list deletions

When items (like steps or resources) are added or removed dynamically, standard
CSS transitions cause adjacent elements to snap instantly to their new locations.
Use **layout animations** to interpolate this reflow smoothly.

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { centralSpringToken } from "@/styles/tokens";

export function TaskList({ tasks, onDelete }) {
  return (
    <div className="grid gap-4">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <motion.div
            layout
            key={task.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={centralSpringToken}
          >
            <TaskCard task={task} onDelete={onDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### 8.3 Defensive layout rules

1. **`mode="popLayout"`** — always specify on `<AnimatePresence>` when wrapping
   elements that affect document reflow. This pops the exiting element out of the
   layout flow, allowing surrounding elements to animate into their new positions
   immediately rather than waiting for the exit animation to complete.
2. **`layout` attribute** — the direct child of `<AnimatePresence>` must have
   `layout` set. This tells Framer Motion to watch the element's bounding box and
   animate size or position changes.
3. **Key declarations** — the animated child must have a unique, stable `key`. Avoid
   index offsets; use database UUIDs.

---

## 9. Build & dev server

### 9.1 Commands

| Purpose                                                       | Command                                              |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| Install deps (runs `keycloakify sync-extensions` postinstall) | `npm install`                                        |
| Dev server (`:5173`)                                          | `npm run dev`                                        |
| Production build (`tsc -b` + `vite build`)                    | `npm run build`                                      |
| Lint                                                          | `npm run lint`                                       |
| All unit tests (CI-friendly, non-watch)                       | `npm run test`                                       |
| Unit tests only (excludes a11y)                               | `npm run unit`                                       |
| A11y tests only                                               | `npm run a11y`                                       |
| **Definition of Done (one command)**                          | `npm run try` (install + build + lint + unit + a11y) |
| Storybook (`:6006`)                                           | `npm run storybook`                                  |
| Build Keycloak theme                                          | `npm run build-keycloak-theme`                       |
| Dev Keycloak theme                                            | `npm run dev-keycloak-theme`                         |
| Full stack via Docker (`:3000`)                               | `docker compose up --build`                          |

### 9.2 Vite config

`vite.config.ts` wires:

- `@vitejs/plugin-react` — React fast refresh / JSX transform.
- `@tailwindcss/vite` — Tailwind v4 Vite plugin.
- `keycloakify({ accountThemeImplementation: "none" })` — Keycloakify Vite plugin.
- Dev proxy (see §6.4).
- Vitest config: `environment: 'jsdom'`, `globals: true`,
  `setupFiles: './tests/unit/setup/vitest.setup.ts'`.

### 9.3 TypeScript config

- `tsconfig.app.json` — `verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`
  (so `.ts`/`.tsx` extensions on relative imports are allowed and encouraged),
  `target: es2023`, `jsx: react-jsx`, strict linting flags.
- `tsconfig.node.json` — for Vite config files.
- `tsconfig.test.json` — for test files (relaxes some lint rules).

---

## 10. Deployment

### 10.1 Docker

- `Dockerfile` — multi-stage build: Node base → builds the Vite app → serves static
  files via nginx.
- `docker-compose.yml` — single `frontend` service, maps host `:3000` → container
  `:80`, adds `host.docker.internal` for backend/Keycloak reachability.
- `nginx.conf` — static file serving + SPA fallback to `index.html`.

### 10.2 Kubernetes

`k8s/` (inside this repo, not a separate `sprintstart-k8s` repo) holds per-component
Kubernetes manifests.

### 10.3 Keycloak theme

`npm run build-keycloak-theme` produces a Keycloak theme JAR/ZIP under
`dist_keycloak/` (gitignored) deployable to a Keycloak instance.

---

## 11. Reference

- [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) — TS / React / Tailwind / a11y conventions.
- [FRONTEND_DOCUMENTATION_GUIDELINES.md](./FRONTEND_DOCUMENTATION_GUIDELINES.md) — TSDoc/JSDoc rules.
- [testing_strategy.md](./testing_strategy.md) — Vitest + MSW + vitest-axe setup.
- [../AGENTS.md](../AGENTS.md) — short-context orientation guide for AI agents.
- [../README.md](../README.md) — setup, prerequisites, env vars, developer notes.
