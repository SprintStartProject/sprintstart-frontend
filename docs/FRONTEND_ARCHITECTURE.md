# Frontend Architecture

This document describes how `sprintstart-frontend` is built: structure, routing,
state, services, design-system mechanics, build and deployment. Rules for writing
code live in the coding standards; this file only describes.

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
- **TanStack Query 5** as the shared cache for all backend data (see §5.2).
- **Tailwind CSS v4** with a single shared semantic palette (light/dark themes).
- **Framer Motion 12** with centralized spring transition tokens.
- **Keycloakify 11** for a custom Keycloak login theme.

---

## 2. Tech stack

| Area                      | Technology                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| UI framework              | **React 19**                                                                                    |
| Routing                   | **React Router v7** (`react-router-dom` ^7)                                                     |
| Server state              | **TanStack Query 5** (`@tanstack/react-query`)                                                  |
| Language                  | **TypeScript** (strict, `verbatimModuleSyntax`)                                                 |
| Build tooling             | **Vite 8**                                                                                      |
| Styling                   | **Tailwind CSS v4** (semantic design tokens, light/dark themes)                                 |
| Animation                 | **Framer Motion 12** (centralized spring tokens)                                                |
| Authentication            | **Keycloak** via `keycloak-js`, with a custom login theme built on **Keycloakify 11**           |
| Markdown / math rendering | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter`       |
| Graphs and diagrams       | `@xyflow/react` (node canvases), `dagre` (layered layout), `d3-force` (competency graph layout) |
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
│   ├── access/              # Stored connector credentials (admin access management)
│   ├── admin/               # User, project & token management, create-project wizard
│   ├── ai-activity/         # Live AI progress log for generations (useAiStream)
│   ├── arrival/             # Arrival step authoring (Hire Setup)
│   ├── attestation/         # Requests to confirm a hire's work
│   ├── blueprints/          # Onboarding path blueprints: graph editor, versions
│   ├── board/               # The hire's board: cards, areas, stages, marks, server sync
│   ├── buddy/               # AI buddy: conversation, drafts, proposals for the board and the onboarding path
│   ├── chatbot/             # Streaming AI assistant
│   ├── competency-graph/    # Force layout for the competency graph
│   ├── connectors/          # Connector + source allow/deny management
│   ├── dashboard/           # Personal dashboard grid and widgets
│   ├── data-ingestion/      # Sources, ingestion runs, artifacts
│   ├── easter-eggs/         # Hidden mini-games
│   ├── faq/                 # AI FAQ clusters (insights)
│   ├── graph-diagram/       # Shared xyflow diagram canvas with dagre layout
│   ├── knowledge-base/      # Artifact browsing + streamed summaries
│   ├── knowledge-gaps/      # AI-detected documentation gaps (insights)
│   ├── knowledge-request/   # Escalated questions inbox and answers (insights)
│   ├── moments/             # Celebration animations (launch, path reveal, completion)
│   ├── onboarding/          # AI onboarding paths, journey canvas, generation, checks
│   ├── onboarding-metrics/  # Onboarding progress and attention per hire (insights)
│   ├── orientation/         # Task orientation editor and panel
│   ├── pm-area/             # PM workspace layout (PmWorkspace), team roster, attention analysis
│   ├── profile/             # User profile view/edit
│   ├── projects/            # Project selection (ProjectProvider)
│   ├── settings/            # User settings, personal credentials
│   ├── shortcuts/           # Global keyboard shortcuts
│   ├── starter-work/        # Starter task pool and review (Hire Setup)
│   ├── task-pool/           # Grabbing a task from the pool
│   └── team-management/     # Team overview, member detail, Skill Wizard
├── pages/               # Route-level views (one per user-facing flow)
├── router/              # AppRouter.tsx (incl. ManagerAreaGuard) + AuthGuard.tsx
├── auth/                # accessPolicy.ts (AppRoute union + canAccessRoute), redirectUtils.ts
├── context/             # Global providers (Auth, Theme, Chat, Toast, FocusMode)
├── services/            # Backend communication (one module per domain), query client, query keys
├── components/          # Shared UI: common/, layout/, ui/ primitives
├── config/              # keycloak.ts (Keycloak client), contributionWording.ts (wording shared with the backend)
├── hooks/               # Shared hooks (incl. the TanStack Query based fetch hooks)
├── styles/              # Global CSS (index.css) + animation tokens (tokens.ts)
├── mocks/               # Two fixtures used as fallback by teamManagementService
├── keycloak-theme/      # Keycloakify overrides (kc.gen.tsx is generated, do not hand-edit)
├── main.tsx             # Entry point: boots the login theme or the app (see below)
├── main-app.tsx         # React root of the app: StrictMode, BrowserRouter, App
├── App.tsx              # App-level providers (§5.1) around AppRouter
└── bootSplash.ts        # Dismisses the boot splash that index.html paints before React
```

`main.tsx` decides at runtime what this bundle is: when Keycloak injected a
`window.kcContext`, it loads the login theme (`keycloak-theme/main`); with
`VITE_KC_DEV=true` it loads the theme's dev preview (`keycloak-theme/main.dev`);
otherwise it loads the app (`main-app`). The login theme and the app are built from
the same `index.html`.

> **Note:** there is **no `src/types/` folder**. Global types live alongside their
> consumers (e.g. `src/services/types.ts` for backend DTOs, `src/auth/accessPolicy.ts`
> for routing types).

**Rule:** new feature work → a `features/<name>/` slice. Promote to `components/` or
`context/` only when the code is truly shared across features.

**Known exception:** the connector registry (`features/data-ingestion/connectors/`) is
imported by knowledge-base, chatbot, connectors, dashboard and admin, so a connector
is a platform concept even though it lives inside the data-ingestion slice. Those
features import only from the registry and `sourceSystems.ts`, never from
data-ingestion components.
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

All pages except `LoginPage` are loaded lazily with `React.lazy` behind one shared
`Suspense` fallback (`PageShellSkeleton`). `LoginPage` is bundled eagerly because the
Keycloak redirect chain can land on it through several full page reloads in a row.

Two layout routes group pages that share a header: `AssistantShell` for `/chat` and
`/buddy`, and `PmWorkspace` for the PM area (`/pm-dashboard`, `/team-management`,
`/team/:userId` and the `/insights/*` pages).

Routes that a user without access must not reach by URL are wrapped in
`ManagerAreaGuard`: the PM area, `/data-ingestion`, `/blueprints` and `/hire-setup`.
It waits for the project context to load and redirects to `getDefaultRoute` when
`canAccessRoute` fails.

### 4.2 AuthGuard (`src/router/AuthGuard.tsx`)

`AuthGuard` handles authentication and the app-wide redirects. Role-based URL
blocking is done by `ManagerAreaGuard` (§4.1). `AuthGuard`:

1. Reads `status` (`loading` | `signingOut` | `unauthenticated` | `authenticated`)
   and `profile` from `useAuth()`.
2. Redirects unauthenticated users to `/login`. The original target is stored in
   `sessionStorage` (`src/auth/redirectUtils.ts`) and also passed as `?redirect=`
   and `location.state.from`, because the Keycloak round trip loses the router state.
3. Redirects authenticated users on `/login` to the stored target, or to
   `getDefaultRoute(profile)` when there is none. When Keycloak returns to `/` or
   strips the hash fragment, it restores the stored target as well.
4. Redirects authenticated users who need a skill assessment to `/skill-wizard`
   (the only route exempt from the skill-assessment gate).
5. Blocks `/onboarding` and `/onboarding/:stepId` for users who have completed
   onboarding.
6. Renders a page skeleton while auth state or the skill-assessment check is in
   flight. It renders nothing while `status` is `signingOut` (a logout return or a
   failed silent SSO check), and nothing while `loading` on `/login`, because the
   skeleton's header does not match the login card.

### 4.3 Access policy (`src/auth/accessPolicy.ts`)

Route-level authorization is centralized in `src/auth/accessPolicy.ts`:

- **`AppRoute` union** — every protected route literal (e.g. `'/'`, `'/chat'`,
  `'/admin'`, `'/pm-dashboard'`, `'/team-management'`, `'/insights/faq'`,
  `'/insights/knowledge-gaps'`).
- **`routePermissions`** — `Record<AppRoute, readonly PermissionGroup[]>` mapping
  each route to the groups allowed to access it.
- **`canAccessRoute(profile, route, managesSelectedProject)`**: returns `true` if the
  user's `permissionGroup` is in the route's allow-list. For PMs on the routes in
  `MANAGER_ASSIGNMENT_ROUTES` it also requires that they manage the selected project
  (`canManageSelected` from `useProjectContext()`).
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

Declared in `AppRouter.tsx`:

```
/login                          /pm-dashboard
/skill-wizard                   /team-management
/                               /team/:userId
/chat                           /insights/faq/:groupId?
/chat/:id                       /insights/knowledge-gaps/:gapId?
/buddy                          /insights/knowledge-requests
/onboarding                     /insights/onboarding
/onboarding/:stepId             /admin
/board                          /hire-setup
/knowledge-base                 /arrival-steps   (redirects to /hire-setup)
/blueprints                     /starter-work    (redirects to /hire-setup)
/blueprints/:pathId             /settings
/data-ingestion                 /profile         (redirects to /settings)
                                *                (NotFoundPage)
```

---

## 5. State management

There is **no global store** (no Redux, Zustand, etc.). Backend data lives in the
TanStack Query cache (§5.2). Cross-cutting client state is handled by React Context
providers.

### 5.1 Context providers

Global providers in `src/context/`:

| Provider / hook                      | File                                                              | Responsibility                                                                               |
| ------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `AuthProvider` + `useAuth`           | `AuthProvider.tsx`, `AuthContext.ts`, `useAuth.ts`                | Initializes Keycloak, fetches the user profile (with retries), exposes `status` + `profile`. |
| `ThemeProvider` + `useTheme`         | `ThemeProvider.tsx`, `ThemeContext.ts`, `useTheme.ts`             | Light/dark/system theme via `.dark` class on `document.documentElement`; persists choice.    |
| `ToastProvider` + `useToast`         | `ToastProvider.tsx`, `ToastContext.ts`, `useToast.ts`             | App-wide toasts that survive route changes.                                                  |
| `ChatProvider`                       | `ChatProvider.tsx`, `ChatContext.ts`                              | Active conversation state for the chatbot feature.                                           |
| `FocusModeProvider` + `useFocusMode` | `FocusModeProvider.tsx`, `FocusModeContext.ts`, `useFocusMode.ts` | Lets a page put the app shell into focus mode.                                               |

Feature providers mounted at app level (`App.tsx`):

| Provider                    | Location                          | Responsibility                                                                          |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `ProjectProvider`           | `features/projects/`              | Loads the user's projects, holds the globally selected project and `canManageSelected`. |
| `MyKnowledgeGapsProvider`   | `features/knowledge-gaps/`        | Knowledge gaps the user owns in the selected project.                                   |
| `MomentsProvider`           | `features/moments/`               | Celebration animations, e.g. the launch sequence after login.                           |
| `CardMarksProvider`         | `features/board/marks/`           | Highlights on board cards, shared with the selection toolbar.                           |
| `OnboardingJourneyProvider` | `features/onboarding/generation/` | Onboarding path generation that keeps running across route changes.                     |
| `BuddyProvider`             | `features/buddy/`                 | AI buddy session and drafts.                                                            |

Feature-local state stays inside the feature (e.g. `onboarding` step state lives in
`features/onboarding/`).

### 5.2 Server state (TanStack Query)

All backend reads go through one shared `QueryClient` (`src/services/queryClient.ts`,
`staleTime` 30 s, `retry` 1, cleared on logout). Query keys come from the central
factory in `src/services/queryKeys.ts`. Project-scoped keys always contain the
`projectId`, user-scoped keys the user id.

| Situation                                   | Hook                       |
| ------------------------------------------- | -------------------------- |
| Normal page or widget read                  | `useQueryFetch`            |
| Panel that refreshes itself (polling)       | `useLiveFetch`             |
| Small read in the app shell (badge, count)  | `useRateLimitedRead`       |
| Writes, optimistic updates, custom `select` | `useQuery` / `useMutation` |

`useFetch` is superseded by `useQueryFetch` and has no callers left; only its
`UseFetchResult` type is still imported by `useQueryFetch`. The sidebar warms the page module
and its main query on `pointerdown` (`src/services/routePrefetch.ts`). The reasoning
behind this setup is recorded in ADR-017 in the Wiki, which is still on the Wiki branch
`tanstack-query-adr` and not yet merged into `main`.

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

Used by `chatService`, `knowledgeService`, and `onboardingService`. `buddyService`
and `aiStreamService` do not use it yet and still split and parse their streams in
their own read loops.

### 6.3 Service modules (`src/services/`)

One module per domain (rules for writing them in
[FRONTEND_CODING_STANDARDS.md §7](./FRONTEND_CODING_STANDARDS.md#7-services--api-layer)):

| Module                         | Domain                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| `adminUserService.ts`          | Admin user management                                                 |
| `aiStreamService.ts`           | Live AI progress events (SSE over `fetch`)                            |
| `apiClient.ts`, `apiError.ts`  | Shared fetch wrapper and `ApiError`                                   |
| `arrivalService.ts`            | Arrival steps                                                         |
| `attestationService.ts`        | Attestation requests                                                  |
| `blueprintService.ts`          | Onboarding path blueprints                                            |
| `boardService.ts`              | Board cards and board arrangement sync                                |
| `buddyService.ts`              | AI buddy (SSE streaming)                                              |
| `chatService.ts`               | Chatbot (SSE streaming)                                               |
| `connectorService.ts`          | Connectors + source allow/deny lists                                  |
| `dashboardLayoutService.ts`    | Dashboard widget layout                                               |
| `faqService.ts`                | Insights FAQ clusters                                                 |
| `ingestionService.ts`          | Data ingestion runs + artifacts                                       |
| `knowledgeGapService.ts`       | Insights knowledge gaps                                               |
| `knowledgeRequestService.ts`   | Escalated knowledge requests                                          |
| `knowledgeService.ts`          | Knowledge base + streamed summaries                                   |
| `myStarterWorkService.ts`      | The current hire's starter work                                       |
| `onboardingFeedbackService.ts` | Onboarding feedback                                                   |
| `onboardingGraphService.ts`    | Onboarding journey graph                                              |
| `onboardingMetricsService.ts`  | Onboarding metrics (insights)                                         |
| `onboardingService.ts`         | Onboarding paths, steps, tasks, feedback                              |
| `orientationService.ts`        | Task orientation                                                      |
| `projectService.ts`            | Projects, managed projects, project selection                         |
| `queryClient.ts`               | Shared TanStack Query client (§5.2)                                   |
| `queryKeys.ts`                 | Central query key factory (§5.2)                                      |
| `routePrefetch.ts`             | Sidebar prefetch of page modules and queries (§5.2)                   |
| `sse.ts`                       | Shared SSE stream parser                                              |
| `starterWorkService.ts`        | Starter work pool and review                                          |
| `teamManagementService.ts`     | Team overview, member detail, skills                                  |
| `userService.ts`               | Current user profile                                                  |
| `types.ts`                     | Backend DTO types (the closest thing to a global types folder)        |
| `sources/`                     | Per-source services (GitHub, Jira, Confluence, Atlassian credentials) |

### 6.4 Reverse proxy

Nothing addresses the backend or Keycloak by absolute URL: both are reached through
the frontend's own origin and resolved by a reverse proxy, which differs per
deployment target:

| Route   | Vite dev (`vite.config.ts`) | Docker (`nginx.conf`)       | Kubernetes (`sprintstart-k8s`) |
| ------- | --------------------------- | --------------------------- | ------------------------------ |
| `/api`  | `127.0.0.1:8080`            | `host.docker.internal:8080` | `sprintstart-backend:8080`     |
| `/v1`   | `127.0.0.1:8080`            | not proxied                 | `sprintstart-backend:8080`     |
| `/auth` | `127.0.0.1:8081`            | `host.docker.internal:8081` | `sprintstart-keycloak:8080`    |

The Kubernetes column is the nginx config in `base/sprintstart-frontend/configmap.yaml`
of the `sprintstart-k8s` repository, which is what the cluster runs. `/v1` is
currently unused by the SPA, so its absence in Docker costs nothing today. The
manifests under `k8s/frontend/` in this repository are an older standalone set that
the cluster does not use. They have no `/auth` route, so `config/keycloak.ts`
(which builds the Keycloak URL as `window.location.origin + /auth`) would not work
with them as they are.

---

## 7. Design system

This section describes how the design system is built. The rules for using it
(tokens only, UI primitives, radius/shadow/heading scales, color-blind safety,
contrast, focus) are in
[FRONTEND_CODING_STANDARDS.md §4 and §5](./FRONTEND_CODING_STANDARDS.md#4-styling-tailwind-css-v4).

### 7.1 Semantic tokens

All colors are semantic design tokens, defined as CSS custom properties in
[`src/styles/index.css`](../src/styles/index.css). An `@theme inline` block maps them
to Tailwind utilities with the `app-` prefix. The families:

- **Surfaces**: `bg-app-bg`, `bg-app-surface`, `bg-app-surface-muted`
- **Text**: `text-app-text`, `text-app-text-muted`, `text-app-text-subtle`
- **Borders**: `border-app-border`, …
- **Brand**: `bg-app-brand`, `text-app-brand`, …
- **Status**: `success` / `warning` / `danger` / `neutral`, each with `-bg`,
  `-border` and `-text` variants, plus `-solid` for all but `neutral`
  (e.g. `bg-app-success-bg text-app-success-text`)

### 7.2 Light / dark theme

`ThemeProvider` sets the `.dark` class on `document.documentElement` and persists the
choice (light, dark or system). `index.css` defines the light values under `:root`
and overrides them under `.dark`, so anything styled with tokens follows the theme
without `dark:` prefixes. `@custom-variant dark` is there for the rare case that
needs one.

---

## 8. Animation system (Framer Motion 12)

The codebase uses `framer-motion` (^12) directly through `motion.*` components and
`<AnimatePresence>`. The rules for using it are in
[FRONTEND_CODING_STANDARDS.md §6](./FRONTEND_CODING_STANDARDS.md#6-animation-framer-motion-12).

Every shared motion value lives in [`src/styles/tokens.ts`](../src/styles/tokens.ts),
each with a TSDoc comment saying when to use it. Read the file rather than a copy of
it here; it falls into four groups:

- **Spring transitions**: `centralSpringToken` (the default for layout and list
  motion), `hoverSpringToken` (hover and tap micro-interactions), plus a few
  specialised springs such as `sidePanelSlideToken` or `celebrationSpringToken`.
- **Button motion**: `buttonHoverMotion` and `buttonHoverMotionDisabled`, which
  `ui/Button` applies itself. Despite the name they only scale on press, not on
  hover.
- **Dialog variants**: `modalBackdropVariants` and `getModalDialogVariants`, used by
  `ui/Modal`.
- **Timing constants**: e.g. `SIDE_PANEL_SLIDE_MS`, `SKELETON_APPEAR_DELAY_MS`.

The variant factories take a `prefersReducedMotion` flag, and `ui/Button` drops its
press feedback when the user prefers reduced motion. In tests, `framer-motion` is
replaced by a passthrough mock (see
[testing_strategy.md §5](./testing_strategy.md#5-global-setup-testsunitsetupvitestsetupts)).

---

## 9. Build & dev server

### 9.1 Commands

All npm scripts are listed in the [README](../README.md#commands--scripts).

### 9.2 Vite config

`vite.config.ts` wires:

- `@vitejs/plugin-react` — React fast refresh / JSX transform.
- `@tailwindcss/vite` — Tailwind v4 Vite plugin.
- `keycloakify({ accountThemeImplementation: "none" })` — Keycloakify Vite plugin.
- Dev proxy (see §6.4).
- Vitest config: `environment: 'jsdom'`, `globals: true`,
  `setupFiles: './tests/unit/setup/vitest.setup.ts'`, a 30 s test timeout, and an
  alias that routes `@testing-library/react` through `tests/unit/setup/rtl.tsx` (see
  [testing_strategy.md §4](./testing_strategy.md#4-vitest-configuration)).

### 9.3 TypeScript config

- `tsconfig.app.json` — `verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`
  (so `.ts`/`.tsx` extensions on relative imports are allowed),
  `target: es2023`, `jsx: react-jsx`, strict linting flags.
- `tsconfig.node.json` — for Vite config files.
- `tsconfig.test.json` — for test files: extends `tsconfig.app.json`, adds the
  `vitest/globals` and `jsdom` types, and includes `tests/`.

---

## 10. Deployment

### 10.1 Docker

- `Dockerfile` — multi-stage build: Node base → builds the Vite app → serves static
  files via nginx.
- `docker-compose.yml` — single `frontend` service, maps host `:3000` → container
  `:80`, adds `host.docker.internal` for backend/Keycloak reachability.
- `nginx.conf` — static file serving + SPA fallback to `index.html`.

### 10.2 Kubernetes

The cluster deployment is defined in the separate `sprintstart-k8s` repository
(Kustomize base and dev/prod overlays, deployed through Argo CD with image updater).
`k8s/frontend/` in this repository holds an older standalone set of manifests that
the cluster does not use.

### 10.3 Keycloak login theme

`src/keycloak-theme/` is a Keycloakify login theme. Most of it is regenerated by
`keycloakify sync-extensions` on every `npm install` and is gitignored (see
`src/keycloak-theme/.gitignore`); the files committed to git are ours. `kc.gen.tsx`
is committed as well but generated, so do not hand-edit it.

**It does not inherit the app's design system for free.** The theme boots its own,
separate React root: no `ThemeProvider`, no `AuthProvider`, nothing from
`main-app.tsx`'s tree. Exactly one thing crosses that boundary automatically:

- **CSS custom properties.** `login/styleLevelCustomization.tsx` imports
  `src/styles/index.css` directly, so the `--color-app-*` tokens and the
  `.app-aurora` / `.app-bg-grid` / etc. keyframes are available as-is in `login.css`.

Everything else is **not shared** and exists twice, as hand-maintained copies:

- `SpotlightCard`, `AuroraBackground` and the animated `SidebarLogo` mark have
  trimmed-down copies under `src/keycloak-theme/login/components/`. They read
  `localStorage` directly for settings like `isAuroraEnabled` and `isTiltEnabled`,
  since there is no `ThemeContext` there.
- `ui/Button` and `ui/Input` have no component copy. The login form is Keycloak's own
  markup, so their look (radius, focus ring, hover and press feedback) is rebuilt in
  CSS on Keycloak's classes in `login/login.css`.

When a shared primitive or token changes, the copy has to be ported by hand (rule in
[FRONTEND_CODING_STANDARDS.md §4](./FRONTEND_CODING_STANDARDS.md#4-styling-tailwind-css-v4)).

**Deploying a theme change is a second step, in a second repo.** Editing
`src/keycloak-theme/` only changes source here. To make it visible anywhere:

1. `npm run build-keycloak-theme` (needs a local Maven and JDK, because
   `keycloakify build` shells out to `mvn` to package the theme JAR).
2. Copy `dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar` into
   `sprintstart-backend/infra/keycloak/themes/` (a different repo; the JAR is
   committed there as a binary).
3. Rebuild the Keycloak image there (`docker compose up --build keycloak` locally,
   `publish-keycloak.yml` in CI).

Nothing syncs the two repos automatically. Skip this and the running Keycloak keeps
serving whatever theme JAR was last committed, while the source here moves on
without it.
