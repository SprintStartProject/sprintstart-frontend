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

---

## 2. TypeScript

- **`verbatimModuleSyntax: true`** — type imports MUST be `import type { ... }`:

  ```typescript
  import type { TaskDto } from '../types';
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

---

## 4. Styling (Tailwind CSS v4)

- **Always use the palette tokens; never hardcode colors.**
  - No `#2563eb`, no raw Tailwind colors like `text-blue-500`.
  - Use the semantic roles: surfaces (`bg-app-bg`, `bg-app-surface`,
    `bg-app-surface-muted`), text (`text-app-text`, `text-app-text-muted`,
    `text-app-text-subtle`), borders (`border-app-border`, …), brand
    (`bg-app-brand`, `text-app-brand`, …), and status (`success` / `warning` /
    `danger` / `neutral`, e.g. `bg-app-success-bg text-app-success-text`).

- **Stay consistent beyond color, too.** Use the shared Tailwind scale for spacing,
  radius, and sizing instead of arbitrary one-off pixel values.

- **Status pills are [`ui/Badge`](../src/components/ui/Badge.tsx).** Pick the
  `variant` by meaning, not by colour, and `size="sm"` inside dense rows. A
  hand-written `rounded-full … px-2 … text-xs` span is how the codebase ended up
  with the same "Unread" chip in four slightly different sizes.

  If a badge needs a colour that no variant covers, add a token pair to
  `index.css` and a variant here — never a raw palette value at the call site,
  which cannot follow the theme.

- **No custom standalone `.css` classes** unless styling third-party widgets or
  dealing with browser overrides.

- **Light/dark theme** is controlled via the `.dark` class (`@custom-variant dark`),
  managed by `ThemeProvider`. Every color must work in both themes — which is
  automatic when you use tokens.

- **Every action control is [`ui/Button`](../src/components/ui/Button.tsx) — do not
  hand-roll a `<button>` with its own classes.** Pick `variant` by intent
  (`primary` | `secondary` | `ghost` | `danger` | `dangerSoft` | `dangerGhost`)
  and `size` by density (`sm` | `md` | `lg`, default `md`); height, radius, type
  scale, hover, focus ring and disabled treatment then follow automatically.
  Use `loading` rather than wiring up your own spinner, and `iconOnly` (plus an
  `aria-label`) for square icon buttons. If a variant you need is missing, add it
  to the component instead of patching it at the call site.

  Legitimate exceptions — these are *not* action buttons and stay hand-written:
  clickable cards and list rows, `aria-pressed` toggles and filter chips,
  `role="menuitem"` / combobox triggers, and the game surfaces.

- **Radius scale.** `rounded-lg` for dense controls (`sm` buttons, chips),
  `rounded-xl` for standard controls and small cards, `rounded-2xl` for content
  cards and panels. Reserve `rounded-full` for avatars, badges, and pills.

- **Text controls are [`ui/Input`](../src/components/ui/Input.tsx),
  [`ui/Textarea`](../src/components/ui/Textarea.tsx) and
  [`ui/Select`](../src/components/ui/Select.tsx).** They share `FieldSize` with
  `Button`, so a control and a button in the same row are the same height. Use
  `icon` for a leading search/key glyph and `trailing` for an action pinned
  inside the right edge, rather than positioning them absolutely by hand.

- **Wrap a labelled control in [`ui/Field`](../src/components/ui/Field.tsx).**
  It generates the id, binds the `<label>`, collects `hint` and `error` into
  `aria-describedby` and sets `aria-invalid` — the wiring hand-written forms
  keep forgetting. Pass the message to `error`; do not render your own `<p>`
  below the field, or screen readers will never hear it.

  ```tsx
  <Field label="Token name" hint="Shown in the token list." error={nameError}>
      <Input value={name} onChange={(e) => setName(e.target.value)} />
  </Field>
  ```

  Hand-written markup stays right for composite controls where the box is
  shared — the "Every _n_ minutes" row, the chat composer, the borderless quick
  chat field — and for checkboxes, radios and file pickers, which are a
  different anatomy.

- **A `Textarea` grows with its content.** That is the default; set `minRows`
  and `maxRows` rather than a fixed `h-*` or a `rows`. Reach for
  `autoResize={false}` only when a height genuinely must not move, and say why
  in a comment. A control that is styled identically to its neighbour but
  behaves differently is worse than one that looks different too.

  A textarea that cannot use `Textarea` — borderless, inside a shared box —
  still shares the behaviour via
  [`useAutoResize`](../src/components/ui/useAutoResize.ts). Do not re-implement
  the height maths inline: every hand-rolled copy so far forgot to shrink the
  field again when the value was reset from the outside.

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

---

## 6. Animation (Framer Motion 12)

- **Use the centralized spring transition tokens** — don't inline ad-hoc spring
  configs. Canonical implementation: [`src/styles/tokens.ts`](../src/styles/tokens.ts),
  exporting `centralSpringToken` (default layout/list motion) and `hoverSpringToken`
  (micro-interactions).

- **Wrap dynamically added/removed elements** (lists, drawers) in `<AnimatePresence>`
  to avoid clipping on exit. Use `mode="popLayout"` when the wrapper affects
  document reflow.

- **Do not apply `buttonHoverMotion` by hand.**
  [`ui/Button`](../src/components/ui/Button.tsx) already carries it, for every
  variant and size, and swaps to `buttonHoverMotionDisabled` when the button is
  disabled or loading. Reaching for `<motion.button {...buttonHoverMotion}>` is
  how the app ended up with a "Refresh" icon button that magnified on one page
  header and sat dead on the next.

  The token stays public for the controls that are *not* `Button` and still need
  to feel the same — the `role="combobox"` trigger in `FilterSelect` and the
  `aria-pressed` filter chips. Those, and only those.

- **The brand lift shadow (`hover:shadow-app-brand-lift`) belongs to `primary`
  and to nothing else.** It marks the one action a screen wants; if every button
  glowed, the cue would carry no information. It is a token in `index.css` with
  separate light and dark values — never an arbitrary `shadow-[…]` value, which
  cannot adapt to the theme.

- See [FRONTEND_ARCHITECTURE.md §8](./FRONTEND_ARCHITECTURE.md#8-animation-system-framer-motion-12)
  for the full animation system.

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

- Don't document obvious assignments, trivial state updates, plain JSX, or restate
  names. Keep comments current — update/remove them when behavior changes.

---

## 10. Anti-patterns (do not)

- **No `any`** (TypeScript) — type it properly.
- **No suppressions** — `// @ts-ignore`, `// @ts-expect-error`,
  `# type: ignore`, `@SuppressWarnings`-style escape hatches. Fix the underlying
  type mismatch instead.
- **No hardcoded colors** — use the shared palette tokens.
- **No ad-hoc spring configs** — use `src/styles/tokens.ts`.
- **No empty `catch` blocks** — surface backend failures.
- **No class components** — functional + hooks only.
- **No default exports** except lazy-loaded route pages.

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
