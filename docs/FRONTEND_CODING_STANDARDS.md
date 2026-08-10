# Frontend Coding Standards & Conventions

These are the coding standards for `sprintstart-frontend`. Developers and AI agents
must follow these rules to maintain a predictable, clean, and highly maintainable
codebase. This file is the frontend-only companion to the root-level
`CODING_STANDARDS.md` (which also covers Kotlin and Python); a developer cloning
only this repository gets the full set of frontend rules here.

> **Related docs**
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — feature-first structure, routing, state, design system, animation.
> - [FRONTEND_DOCUMENTATION_GUIDELINES.md](./FRONTEND_DOCUMENTATION_GUIDELINES.md) — TSDoc/JSDoc rules.
> - [testing_strategy.md](./testing_strategy.md) — Vitest + MSW + vitest-axe setup.

---

## 1. General principles

- **Explicit over implicit** — avoid magic behaviours. Inheritances, annotations,
  and event chains should be easily traceable and documented.
- **Typing is mandatory** — bypassing the type checker is prohibited.
- **Keep abstractions lean** — do not design layers of abstraction for potential
  future use. Create them only when design requirements or interface configurations
  necessitate it.
- **Tool discipline** — use search and reading tools first to understand the
  existing design system before applying changes.
- **Reduced motion first** — every animation must be safe to collapse. The
  `'classic'` style mode and `prefers-reduced-motion` media query must never break
  functionality.

---

## 2. TypeScript

- **`verbatimModuleSyntax: true`** — type imports MUST be `import type { ... }`:

  ```typescript
  import type { TaskDto } from '../types.ts';
  ```

- **Explicit `.ts`/`.tsx` extensions on relative imports are allowed and encouraged**
  (`tsconfig.app.json` has `allowImportingTsExtensions: true`). Mix is fine —
  follow the convention of the file you're editing.

- **`any` is strictly forbidden.** Narrow types using explicit interfaces or type
  guards. (ESLint: `@typescript-eslint/no-explicit-any: warn`.)

- **`eqeqeq: error`** — always `===` / `!==`.

- **`prefer-const: warn`** — use `const` unless reassignment is genuinely needed.

- **No unused vars** — prefix intentionally-unused identifiers with `_`
  (`argsIgnorePattern: ^_`, `varsIgnorePattern: ^_`, `caughtErrorsIgnorePattern: ^_`).

- **`no-console: warn`** — only `console.warn` and `console.error` are allowed;
  no stray `console.log`.

- **No suppressions** — never commit `// @ts-ignore`, `// @ts-expect-error`, or
  `// eslint-disable-*`. Fix the underlying type mismatch instead.

---

## 3. React

- **Functional components + hooks only.** Class components are legacy and not used.

- **Named exports ONLY**, except lazy-loaded route pages which require default
  exports:

  ```typescript
  // Good
  export function MyComponent() { ... }
  export const MyComponent = () => { ... };
  ```

- **Keep components focused.** Extract hooks for non-trivial logic/state.

- **Comments and identifiers in English.**

- **Services return typed responses and surface backend failures** — don't silently
  swallow errors (no empty `catch`).

- **Error boundaries** should wrap each page-level route in `AppRouter`. The global
  fallback is a minimal "Something went wrong" view with a retry action.

---

## 4. Styling (Tailwind CSS v4)

- **Always use the palette tokens; never hardcode colors.**
  - No `#2563eb`, no raw Tailwind colors like `text-blue-500`.
  - Use the semantic roles: surfaces (`bg-app-bg`, `bg-app-bg-soft`, `bg-app-surface`,
    `bg-app-surface-muted`, `bg-app-surface-hover`), text (`text-app-text`,
    `text-app-text-muted`, `text-app-text-subtle`, `text-app-text-disabled`),
    borders (`border-app-border`, `border-app-border-muted`, `border-app-border-strong`),
    brand (`bg-app-brand`, `text-app-brand`, `border-app-brand`, `bg-app-brand-soft`,
    `text-app-brand-text`, `bg-app-brand-glow`), and status (`success` / `warning` /
    `danger` / `neutral` / `orange`, e.g. `bg-app-success-bg text-app-success-text`).

- **Glassmorphism & glow tokens** (ultra mode):
  - `bg-app-glass`, `border-app-glass-border` (use via the `app-glass` utility class)
  - `bg-app-glow`, `bg-app-glow-accent`, `bg-app-glow-alt` (aurora blobs)
  - See `src/styles/index.css` for the full set.

- **Font tokens**: `font-sans`, `font-heading`, `font-mono`.

- **Reusable UI primitives**:
  - `SpotlightCard` — card wrapper with cursor-driven tilt and spotlight glow.
    Reads `isTiltEnabled` from `ThemeContext`; respects `'classic'` mode.
    Usage:
    ```tsx
    import { SpotlightCard } from '@/components/ui/SpotlightCard';
    <SpotlightCard roundedClassName="rounded-3xl">
      <YourContent />
    </SpotlightCard>
    ```

- **Shared CSS layout utilities**: `app-page-frame` (responsive gutter), `app-page-shell`
  (full page container), `app-page-content` (centered with max-width). Prefer these
  over manual `px-*` on page wrappers.

- **Stay consistent beyond color, too.** Use the shared Tailwind scale for spacing,
  radius, and sizing instead of arbitrary one-off pixel values.

- **No custom standalone `.css` classes** unless styling third-party widgets or
  dealing with browser overrides. Use `@utility` in `index.css` for reusable
  combinations (e.g. `app-glass`).

- **Light/dark theme** is controlled via the `.dark` class (`@custom-variant dark`),
  managed by `ThemeProvider`. Every color must work in both themes — which is
  automatic when you use tokens.

- **Style modes**: the app supports `'ultra'` (default: glassmorphic glow, aurora
  drift, spotlight) and `'classic'` (flat surfaces, no ambient animation). Activated
  via `.style-classic` on `<html>`, managed by `ThemeProvider`. When `'classic'` is
  active, decorative layers (`app-aurora`, `app-spotlight`, `app-bg-grid`) are
  disabled by CSS. Respect this in custom components by checking
  `useTheme().isClassicMode`.

---

## 5. Accessibility (WCAG 2.1 AA)

- **Icon-only buttons MUST have an `aria-label`.**

- **E2E-targeted elements MUST have a `data-testid`.**

- **Keep semantic HTML** and label form fields; respect the `jsx-a11y` lint rules
  (don't disable them casually).

- **Keyboard-navigable** interactive elements with visible focus.

- **Color-blind friendly (required)** — never rely on color **alone** to convey
  meaning. Always back it with an **icon, text label, or shape** (e.g. status =
  chip text + icon, not just red/green).

- **Contrast** — meet **WCAG 2.1 AA** for text and interactive elements.

- **Focus** — keep visible focus via the `--app-focus` token
  (`focus-visible:ring-app-focus`); don't remove outlines.

- **Reduced motion** — the `'classic'` style mode and `prefers-reduced-motion`
  media query must disable all decorative animations. Check
  `useReducedMotion()` from Framer Motion for component-level guards.

---

## 6. Animation (Framer Motion 12)

- **Use the centralized spring transition tokens** — don't inline ad-hoc spring
  configs. Canonical implementation: [`src/styles/tokens.ts`](../src/styles/tokens.ts).

  Core presets:

  | Token | Type | Use case |
  | --- | --- | --- |
  | `centralSpringToken` | spring | Layout transitions, list enter/exit, general motion |
  | `hoverSpringToken` | spring | Hover/tap micro-interactions |
  | `dockMagnifySpringToken` | spring | Sidebar dock magnification (grow/shrink) |
  | `slidingIndicatorSpringToken` | spring | Active nav indicator pill (`layoutId`) |
  | `sidePanelSlideToken` | tween | Side panel slide in/out (guaranteed timing) |
  | `SIDE_PANEL_SLIDE_MS` | number | Panel animation duration (420ms) |
  | `enterTransition` | tween | Page-level enter (AuroraBackground, etc.) |
  | `idleDriftToken` | tween | Decorative breathing loops |
  | `celebrationSpringToken` | spring | Celebration cards (under-damped overshoot) |
  | `flightEaseToken` | tween | Rocket trail / ignition bloom |
  | `petPeekSpringToken` | spring | Rocket pet duck/lean |
  | `modalBackdropVariants` | variants | Backdrop fade for all dialogs |
  | `getModalDialogVariants()` | variants | Dialog surface enter/exit |
  | `buttonHoverMotion` | spread | `motion.button` hover/tap (1.03 scale) |

  See [FRONTEND_ARCHITECTURE.md §8](./FRONTEND_ARCHITECTURE.md#8-animation-system-framer-motion-12)
  for the complete reference.

- **Use the `buttonHoverMotion` spread** for consistent button feedback:

  ```tsx
  import { buttonHoverMotion } from "@/styles/tokens";
  <motion.button {...buttonHoverMotion}>Save</motion.button>
  ```

- **Wrap dynamically added/removed elements** (lists, drawers) in `<AnimatePresence>`
  to avoid clipping on exit. Use `mode="popLayout"` when the wrapper affects
  document reflow.

- **Always specify `layout`** on the direct child of `<AnimatePresence>` so Framer
  Motion interpolates reflow smoothly.

- **The Moments system** (`features/moments/`) owns all celebratory animations.
  Call `useMoments().celebrate(input)` for earned rewards, `useMoments().flyby()`
  for small wins. Don't duplicate celebration patterns.

---

## 7. Services & API layer

- **Use `services/apiClient.ts`** (native `fetch` wrapper) — **not axios**. The
  `apiClient.fetch<T>(endpoint, options)` helper handles JWT refresh, auth headers,
  JSON parsing, and `ApiError` throwing.

- **Typed responses** — every service function declares its return type
  (`Promise<SomeDto>`); never `Promise<any>`.

- **Surface backend failures** — don't silently swallow errors. Empty `catch`
  blocks are forbidden.

- **SSE for streaming** — use `services/sse.ts`'s `parseSSEStream<T>(stream)`
  async generator for chat, summaries, and onboarding personalization streams.

- **One service module per domain** — see [FRONTEND_ARCHITECTURE.md §6.3](./FRONTEND_ARCHITECTURE.md#63-service-modules-srcservices)
  for the actual list.

---

## 8. Testing

- **Framework:** Vitest 4 + Testing Library (`@testing-library/react`,
  `user-event`, `jest-dom`) in a `jsdom` environment, with `msw` for HTTP mocking
  and `vitest-axe` for accessibility checks.

- **Location:** unit tests live under `tests/unit/**`, mirroring `src/` structure
  (`services/`, `components/`, `pages/`, `context/`, `router/`, `features/`,
  `hooks/`, `auth/`, `a11y/`).

- **Run:** `npm run test` (CI-friendly, non-watch). `npm run unit` excludes a11y;
  `npm run a11y` runs a11y only.

- **What to cover:** services (backend contracts, error paths), business/permission
  logic (`AuthGuard`, access policy), hooks, and key page/component behavior — not
  trivial markup.

- **E2E hooks:** elements targeted by end-to-end tests must declare a `data-testid`.

- **Update tests in the same PR** as the component change.

- See [testing_strategy.md](./testing_strategy.md) for the full setup.

---

## 9. Documentation (the *why*, not the obvious *what*)

- Use **TSDoc** blocks on exported symbols — see
  [FRONTEND_DOCUMENTATION_GUIDELINES.md](./FRONTEND_DOCUMENTATION_GUIDELINES.md)
  for the full rules.

- In short, document:
  - **Pages/views:** responsibility, user flow, key backend/auth/routing/state deps.
  - **Reusable components:** when purpose/behavior/constraints aren't obvious.
  - **Props:** when reused, domain-meaningful, callbacks, or backend/auth-constrained
    (skip `id` / `children` / `className` unless special).
  - **Service functions:** purpose, important params, non-obvious return, failure
    behavior — document **every** exported service function.
  - **Hooks/effects:** when timing or dependencies matter.
  - **Business logic:** permission/role rules, conditional flows, data transforms,
    backend-contract assumptions, and **temporary limitations / known backend gaps**.
  - **Moments integration:** when calling `useMoments().celebrate()` or
    `useMoments().flyby()`, document *what* event triggers it, so the tone
    (`success` / `milestone` / `triumph`) stays consistent across the app.

- Don't document obvious assignments, trivial state updates, plain JSX, or restate
  names. Keep comments current — update/remove them when behavior changes.

---

## 10. Anti-patterns (do not)

- **No `any`** (TypeScript) — type it properly.
- **No suppressions** — `// @ts-ignore`, `// @ts-expect-error`,
  `# type: ignore`, `@SuppressWarnings`-style escape hatches. Fix the underlying
  type mismatch instead.
- **No hardcoded colors** — use the shared palette tokens.
- **No ad-hoc spring configs** — use `src/styles/tokens.ts`. (Intentional
  exceptions that are functionally identical to an existing token should be
  refactored to use it; if the damping difference is deliberate, document why.)
- **No empty `catch` blocks** — surface backend failures.
- **No class components** — functional + hooks only.
- **No default exports** except lazy-loaded route pages.
- **No duplicate celebration patterns** — use `useMoments()` rather than
  hand-rolling confetti or flybys.
- **No color-only meaning** — always pair color with an icon, text, or shape.

---

## 11. Enforcement

ESLint flat config ([`eslint.config.js`](../eslint.config.js)):

- `typescript-eslint` recommended **+ type-checked** (`recommendedTypeChecked`).
- `react` flat recommended + `jsx-runtime`.
- `react-hooks` recommended.
- `react-refresh` Vite preset.
- `jsx-a11y` flat recommended.
- `prettier` (formatting via `eslint-config-prettier`).

**Before finishing any change:**

```bash
npm run lint        # ESLint
npm run build       # tsc -b + vite build (type-check + compile)
npm run test        # full Vitest suite (unit + a11y)
# OR, the one-shot Definition of Done:
npm run try         # install + build + lint + unit + a11y
```

Prettier owns formatting — don't fight it; run lint before finishing.