# AGENTS.md — SprintStart Frontend

Shared, committed guide for humans and AI agents working in `sprintstart-frontend`.
Keep it current: if a rule here stops matching reality, fix the rule in the same PR.

> **Related docs**
>
> - [docs/FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md) — system architecture (frontend-only; replaces the frontend section of root ARCHITECTURE.md): feature-first structure, routing, state, design system, animation.
> - [docs/FRONTEND_CODING_STANDARDS.md](./docs/FRONTEND_CODING_STANDARDS.md) — TS / React / Tailwind / a11y rules (frontend-only; replaces the frontend section of root CODING_STANDARDS.md).
> - [docs/FRONTEND_DOCUMENTATION_GUIDELINES.md](./docs/FRONTEND_DOCUMENTATION_GUIDELINES.md) — the full, committed documentation standards (summarized in §6).
> - [docs/testing_strategy.md](./docs/testing_strategy.md) — Vitest + MSW + vitest-axe setup (replaces the old `mocking_strategy.md`).
> - `GEMINI.md` — condensed context (local/agent-specific, gitignored).

---

## 1. Stack & overview

React SPA, feature-first architecture, with Keycloak SSO and a Framer Motion animation layer.

- **React 19**, **React Router v7**, **TypeScript**
- **Tailwind CSS v4** (semantic design tokens, see §7)
- **Framer Motion 12** (centralized spring tokens, `<AnimatePresence>` for exits)
- **Vite 8**, **Keycloakify** (custom Keycloak login theme)
- **Vitest** + **Testing Library** for unit tests (see §5)

---

## 2. Setup & commands

Copy `.env.example` → `.env` and point Keycloak at the right IAM instance before running.

| Purpose                         | Command                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| Install                         | `npm install`                                                 |
| Dev server (`:5173`)            | `npm run dev`                                                 |
| Production build                | `npm run build` (runs `tsc -b` + `vite build`)                |
| Lint                            | `npm run lint`                                                |
| Format / check formatting       | `npm run format` / `npm run format:check`                     |
| Unit tests                      | `npm run test`                                                |
| Storybook                       | `npm run storybook`                                           |
| Keycloak theme dev / build      | `npm run dev-keycloak-theme` / `npm run build-keycloak-theme` |
| Full stack via Docker (`:3000`) | `docker compose up --build`                                   |

**Definition of Done (frontend):** `npm run lint`, `npm run format:check` **and** `npm run build` pass, relevant unit tests pass, and new/changed code is documented per §6. `npm run try` runs the whole chain in one go.

---

## 3. Frontend structure (`src/`)

Feature-first: domain code lives in `features/<name>/`; only genuinely shared code goes in the top-level folders.

- `features/<name>/` — self-contained domains (`components/`, optional `hooks/`, `types.ts`). E.g. `admin`, `chatbot`, `onboarding`, `knowledge-base`, `data-ingestion`, `team-management`, `faq`, `knowledge-gaps`, `connectors`, `profile`, `projects`, `settings`.
- `components/` — shared UI: `common/` (app-level controls), `layout/` (shell, sidebar, drawers), `ui/` (low-level primitives).
- `pages/` — route-level page views (one per user-facing flow).
- `router/` — React Router v7 config + `AuthGuard`.
- `auth/` — access policy (`AppRoute`, `canAccessRoute`, route→permission map).
- `context/` — global providers/hooks (`AuthProvider`, `ThemeProvider`, `ChatProvider`, `ChatPreferencesProvider`, `useAuth`, `useTheme`, `useChatPreferences`).
- `services/` — backend/API communication (one module per domain; SSE streaming via `sse.ts`; HTTP via `apiClient.ts`).
- `config/` — integration config (e.g. `keycloak.ts`).
- `hooks/`, `styles/`, `mocks/` — shared utilities, global CSS/tokens + animation tokens, dev mock data.
- `keycloak-theme/` — Keycloakify overrides (much is generated — do **not** hand-edit `kc.gen.tsx`).

**Rule:** new feature work → a `features/<name>/` slice. Promote to `components/`/`context/` only when it's truly shared.

---

## 4. Coding guidelines & standards

Enforced by ESLint (flat config: `typescript-eslint` recommended **+ type-checked**, `react`, `react-hooks`, `jsx-a11y`, `prettier`). Key rules:

- **`eqeqeq`: error** — always `===` / `!==`.
- **`prefer-const`**, **no unused vars** (prefix intentionally-unused with `_`).
- **`@typescript-eslint/no-explicit-any`: warn** — avoid `any`; type it properly.
- **`consistent-type-imports`** — use `import type { … }` for types (project uses `verbatimModuleSyntax`; keep explicit `.ts`/`.tsx` extensions on relative imports).
- **`no-console`: warn** — only `console.warn` / `console.error` allowed; no stray `console.log`.
- Prettier owns formatting — don't fight it; run lint before finishing.

Conventions:

- Code, identifiers and comments in **English**.
- Keep components focused; extract hooks for non-trivial logic/state.
- Services return typed responses and surface backend failures (don't silently swallow — no empty `catch`).
- **Run `npm run lint` before considering any change done.**

---

## 5. Testing

- **Framework:** Vitest + Testing Library (`@testing-library/react`, `user-event`, `jest-dom`) in a `jsdom` environment.
- **Location:** unit tests live under `tests/unit/**`, mirroring `src/` structure (`services/`, `components/`, `pages/`, `context/`, `router/`, `features/`).
- **Run:** `npm run test` (CI-friendly, non-watch).
- **What to cover:** services (backend contracts, error paths), business/permission logic (`AuthGuard`, access policy), hooks, and key page/component behavior — not trivial markup.
- **E2E hooks:** elements targeted by end-to-end tests must declare a `data-testid`.
- When you change a component that has tests, update its tests in the same PR.

---

## 6. Documentation (the _why_, not the obvious _what_)

Follow the documentation playbook — the full rules live in [docs/FRONTEND_DOCUMENTATION_GUIDELINES.md](./docs/FRONTEND_DOCUMENTATION_GUIDELINES.md). In short — use **TSDoc** blocks on exported symbols:

- **Pages/views:** responsibility, which user flow, key backend/auth/routing/state dependencies.
- **Reusable components:** when purpose/behavior/constraints aren't obvious from the name.
- **Props:** when reused, domain-meaningful, callbacks, or backend/auth-constrained (skip `id`/`children`/`className` unless special).
- **Service functions:** purpose, important params, non-obvious return, failure behavior — document **every** exported service function.
- **Hooks/effects:** when timing or dependencies matter.
- **Business logic:** permission/role rules, conditional flows, data transforms, backend-contract assumptions, and **temporary limitations / known backend gaps**.

Don't document obvious assignments, trivial state updates, plain JSX, or restate names. Keep comments current — update/remove them when behavior changes.

---

## 7. Design system: shared palette, consistency & color-blind accessibility

We have **one shared palette** — a set of semantic design tokens (CSS variables → Tailwind `app-*` classes) defined in [src/styles/index.css](./src/styles/index.css). **Always use it** so the whole app stays visually consistent.

- **Always use the palette tokens; never hardcode colors** (no `#2563eb`, no raw Tailwind colors like `text-blue-500`). Use the semantic roles: surfaces (`bg-app-bg`, `bg-app-surface`, `bg-app-surface-muted`), text (`text-app-text`, `text-app-text-muted`, `text-app-text-subtle`), borders (`border-app-border`, …), brand (`bg-app-brand`, `text-app-brand`, …), and status (`success` / `warning` / `danger` / `neutral`, e.g. `bg-app-success-bg text-app-success-text`).
- **Stay consistent beyond color, too:** use the shared Tailwind scale for spacing, radius and sizing instead of arbitrary one-off pixel values, so padding/margins/gaps match the rest of the app.
- **Light/Dark:** controlled via the `.dark` class (`@custom-variant dark`), managed by `ThemeProvider`. Every color must work in both themes — which is automatic when you use tokens.
- **Color-blind friendly (required):** never rely on color **alone** to convey meaning. Always back it with an **icon, text label, or shape** (e.g. status = chip text + icon, not just red/green) — this is why finished/skipped/locked steps use distinct icons _and_ labels. Keep color pairs distinguishable for common color-vision deficiencies.
- **Contrast:** meet **WCAG 2.1 AA** for text and interactive elements.
- **Focus:** keep visible focus via the `--app-focus` token (`focus-visible:ring-app-focus`) — don't remove outlines.

### Shared UI primitives — use them, don't rebuild them

`src/components/ui/` holds the primitives. Every one of them exists because the same widget had drifted into a dozen slightly different versions. **Reach for the component first; if it can't do what you need, extend the component — never patch it at the call site.**

| Need                   | Use                                        | Not                                             |
| ---------------------- | ------------------------------------------ | ----------------------------------------------- |
| Any action control     | `ui/Button`                                | a hand-styled `<button>` or `<motion.button>`   |
| Text field / dropdown  | `ui/Input`, `ui/Select`, `ui/Textarea`     | a bare `<input>` / `<select>` / `<textarea>`    |
| Label + hint + error   | `ui/Field`                                 | a `<label>` next to an input, wired by hand     |
| Status pill            | `ui/Badge`                                 | `rounded-full … px-2 … text-xs` on a `<span>`   |
| Dialog / drawer        | `ui/Modal`, `ui/SidePanel`                 | a hand-rolled `fixed inset-0` overlay           |
| Waiting                | `ui/Spinner`, or `Button`'s `loading` prop | a bare `<Loader2 className="animate-spin" />`   |
| Nothing to show        | `ui/EmptyState`                            | an ad-hoc centred `<p>`                         |
| Background scroll lock | `ui/useScrollLock`                         | setting `document.body.style.overflow` yourself |

The primitives already carry the focus ring, the 44px touch target, the `disabled` / `aria-busy` treatment, the hover motion, the `aria-describedby` wiring for errors, and the focus trap. Rebuilding one by hand means getting all of that right again, which is how the drift started.

- **Radius scale:** `rounded-lg` dense controls · `rounded-xl` standard controls and surfaces nested inside a card · `rounded-2xl` the card itself · `rounded-full` avatars/badges/pills · `rounded-3xl`+ dialog chrome only.
- **Shadow scale:** `shadow-sm` card at rest · `hover:shadow-lg` that card hovered · `shadow-lg` anything floating over content (popover, tooltip, dropdown, toast, floating button) · `shadow-2xl` dialogs and drawers only. No backdrop behind it means it is not a dialog. `hover:shadow-app-brand-lift` belongs to `Button variant="primary"` alone.

Legitimate exceptions are listed in [docs/FRONTEND_CODING_STANDARDS.md §4](./docs/FRONTEND_CODING_STANDARDS.md) — clickable cards and list rows, `aria-pressed` toggles and filter chips, `role="menuitem"` / combobox triggers, and the game surfaces. Everything else is a `Button`.

### The Keycloak login theme does not inherit any of this for free

`keycloak-theme/` (see §3) boots its own, separate React root — no `ThemeProvider`, no `AuthProvider`, nothing from `main-app.tsx`'s tree. Exactly one thing crosses that boundary automatically:

- **CSS custom properties.** `styleLevelCustomization.tsx` imports `src/styles/index.css` directly, so `--color-app-*` tokens and the `.app-aurora`/`.app-bg-grid`/etc. keyframes are available as-is in `login.css`.

Everything else — `ui/Button`, `ui/Input`, `SpotlightCard`, `AuroraBackground`, the animated `SidebarLogo` mark — is **not shared**. The login theme has its own hand-maintained, trimmed-down copies under `keycloak-theme/login/components/` (reading `localStorage` directly for things like `isAuroraEnabled`/`isTiltEnabled`, since there's no `ThemeContext` to read from there).

**Rule:** if you touch a shared visual primitive or token — button radius/hover, input focus ring, card border/shadow/radius scale, the brand mark's animation, anything in `styles/index.css` — check whether `keycloak-theme/login/` has its own copy of that pattern (`login.css`, or a component under `login/components/`) and port the change there too. Nothing keeps the two in sync for you, and it's easy to ship a design change, see it everywhere it should be, and not notice the login/register page quietly kept the old version.

**Deploying a login-theme change is a second step, in a second repo.** Editing `keycloak-theme/` only changes source here. To make it visible anywhere: `npm run build-keycloak-theme` (needs a local Maven + JDK — `keycloakify build` shells out to `mvn` to package the theme JAR) → copy the resulting `dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar` into `sprintstart-backend/infra/keycloak/themes/` (a **different repo**, the JAR is committed as a binary) → rebuild the Keycloak image there (`docker compose up --build keycloak` locally; `publish-keycloak.yml` in CI). There is no automated sync between the two repos — skip this and the running Keycloak instance keeps serving whatever theme JAR was last committed, however old, while the frontend repo's `keycloak-theme/` source quietly moves on without it.

---

## 8. Responsive design

- **Primary target is desktop** — that's where the app is mainly used, so design for the desktop layout first. (This is _not_ mobile-first.)
- But every page must still be **responsive**: it has to react to the viewport and look good down to phone size — widgets get narrower / stack vertically, the sidebar collapses, and tables/dialogs must not overflow.
- Use Tailwind breakpoints (`sm:`, `md:`, `lg:`) to scale the desktop layout _down_. The app shell already does this: sticky sidebar on desktop → slide-out drawer + top bar below `lg` (see `components/layout/SideBar.tsx`; global token adjustments at `@media (max-width: 1024px)`).
- Prefer fluid layouts (`flex`/`grid`, `max-w-*`, `min-w-0` to allow truncation) over fixed pixel widths.
- **Test desktop (primary), then tablet and mobile** before finishing UI work — check that widgets reflow, the sidebar collapses, and nothing overflows.

---

## 9. Accessibility (WCAG 2.1 AA)

- Icon-only buttons need an `aria-label` (`ui/Button` with `iconOnly` still needs you to pass one).
- Form fields need a label **and**, when they can show an error or a hint, an `aria-describedby` pointing at it — `ui/Field` wires both plus `aria-invalid` for you.
- Keep semantic HTML and label form fields; respect the `jsx-a11y` lint rules (don't disable them casually).
- Keyboard-navigable interactive elements with visible focus (see §7).

---

## 10. Auth & routing (brief)

- **Keycloak** (`keycloak-js`) for IAM; dev requires a Keycloak user with a role (`USER` / `PM` / `HR` / `ADMIN`) and redirect-based login.
- Route access is centralized in `auth/accessPolicy.ts` (`AppRoute` union + `canAccessRoute`) and enforced by `router/AuthGuard.tsx`. **New protected routes must be added to `AppRoute` + the permission map**, or they won't type-check / won't be access-controlled.
- See [docs/FRONTEND_ARCHITECTURE.md §4](./docs/FRONTEND_ARCHITECTURE.md#4-routing--access-control) for the full routing model (declarative `<Route element={...}>` API, not data-router loaders).

---

## 11. Animation (brief)

- Use the **centralized spring transition tokens** (uniform velocity/stiffness) — don't inline ad-hoc spring configs. Canonical implementation: [`src/styles/tokens.ts`](./src/styles/tokens.ts), exporting `centralSpringToken` and `hoverSpringToken`.
- **Don't add hover motion to buttons by hand.** `ui/Button` renders a `motion.button` with `buttonHoverMotion` built in, and honours `prefers-reduced-motion` and `disabled`. That it used to be opt-in is why half the refresh buttons reacted to hover and half didn't.
- Wrap dynamically added/removed elements (lists, drawers) in `<AnimatePresence>` to avoid clipping on exit.
- See [docs/FRONTEND_ARCHITECTURE.md §8](./docs/FRONTEND_ARCHITECTURE.md#8-animation-system-framer-motion-12) for the full animation system.

---

## 12. Git & repo boundaries

- Separate repos: `sprintstart-frontend`, `sprintstart-backend`, `sprintstart-ai`, `sprintstart-ai-ops`, `Wiki`. Don't assume a shared monorepo checkout. (There is **no** `sprintstart-k8s` repo — per-component Kubernetes manifests live inside each repo's own `k8s/` folder; here that's `sprintstart-frontend/k8s/`.)
- Feature work branches off `dev`; PRs target `dev`.
- Agent instruction files: `AGENTS.md` (this file) is **shared/committed**; `GEMINI.md`, `CLAUDE.md`, and `*.local.md` are gitignored (per-developer).
