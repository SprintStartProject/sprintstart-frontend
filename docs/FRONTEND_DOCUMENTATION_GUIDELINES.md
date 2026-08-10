# Frontend Documentation Guidelines

This document defines the strict documentation standards for the React and TypeScript frontend codebase.

> [!IMPORTANT]
> **AI AGENT DIRECTIVE**: As an AI agent working in this codebase, you MUST adhere strictly to these rules. Do not over-document. Do not explain standard React/TS syntax. Only provide comments that explain the **Why** and the **Business Context**.

> **Related docs**
>
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — system architecture (routing, services, state, design system, animation).
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) §9 — documentation rules summary.
> - [testing_strategy.md](./testing_strategy.md) — Vitest + MSW + vitest-axe setup.

---

## 1. General Principles

- **Document the "Why", not the "What"**: Comments MUST explain the purpose, reasoning, or business context behind the code. NEVER write comments that merely restate what the code does.
- **Keep Docs Synced**: Update documentation immediately when code behavior changes. Outdated documentation is considered worse than no documentation.
- **TSDoc/JSDoc Format**: You MUST use standard JSDoc/TSDoc format blocks for all functions, interfaces, hooks, and components that require documentation.

```typescript
/**
 * Description of the class, component, or helper explaining its business purpose.
 */
```

---

## 2. Components

### Views & Page-Level Components

You MUST document all page-level or view-level components. Describe the view's responsibility, route context, and its main sub-components.

```tsx
/**
 * RoleSelectionView
 *
 * Allows users to select their working area during the onboarding process.
 * Bound to the `/onboarding/select-role` route.
 *
 * The selected role is stored in the backend and used to generate
 * a personalized onboarding path.
 */
export function RoleSelectionView() { ... }
```

### Reusable UI Components

Document reusable components when their purpose or usage context is not immediately obvious. Document intended use cases, responsive boundaries, and specific layout states. Small presentational components with self-explanatory names do not require documentation.

```tsx
/**
 * TaskCard
 *
 * Displays a summary card for an onboarding task inside the onboarding phase dashboard.
 * Includes interactive hover state transitions using spring motion configurations.
 */
export function TaskCard(props: TaskCardProps) { ... }
```

---

## 3. Props & Routes Documentation

### Interface Props

Document the props of components when:

- The component is reused in multiple places.
- The meaning of a prop is not obvious.
- The prop influences complex behavior.
- The prop contains callback functions.

```tsx
type TaskCardProps = {
  /**
   * Unique database identifier of the onboarding task.
   */
  taskId: string;

  /**
   * Status of the task. Governs card accent colors and icon displays.
   */
  status: "OPEN" | "IN_PROGRESS" | "DONE";

  /**
   * Callback fired when the user selects the card to open detail panels.
   */
  onSelect: (taskId: string) => void;
};
```

_Do not_ document obvious props like `id`, `className`, or `children` unless additional context is strictly necessary.

### React Router v7 Routes

This codebase uses React Router v7's **declarative `<Route element={...}>` API**
guarded by an `AuthGuard` wrapper component — **not** the data-router
`loader`/`action` APIs. There are no `LoaderFunctionArgs` or route loaders in the
codebase. (See [FRONTEND_ARCHITECTURE.md §4](./FRONTEND_ARCHITECTURE.md#4-routing--access-control)
for the full routing model.)

Document route components with their route path, the `AppRoute` literal they
correspond to in `src/auth/accessPolicy.ts`, the permission groups allowed to
access them, and any auth/redirect behavior the `AuthGuard` enforces for them:

```tsx
/**
 * AdminPage
 *
 * The admin dashboard. Bound to the `/admin` route (`AppRoute` literal in
 * `src/auth/accessPolicy.ts`). Accessible only to `HR` and `ADMIN` permission
 * groups (see `routePermissions`).
 *
 * `AuthGuard` redirects unauthenticated users to `/login` and authenticated
 * users without the required group to their default route via
 * `getDefaultRoute(profile)`.
 */
export function AdminPage() { ... }
```

For sub-routes with dynamic params, document the param shape and where the value
comes from:

```tsx
/**
 * TeamMemberDetailPage
 *
 * Bound to `/team/:userId`. The `userId` path param is read via `useParams()`
 * and fetches the member's detail from `teamManagementService`. Linked from
 * `TeamManagementPage`'s member cards.
 */
export function TeamMemberDetailPage() { ... }
```

---

## 4. Functions and Business Logic

Functions MUST be documented whenever they contain business logic or behavior that is not immediately obvious.

### Async Operations & User Actions

```tsx
/**
 * Loads the current user profile when the application starts.
 *
 * The result determines whether the user can access protected routes
 * or needs to complete the role selection first.
 */
const initAuth = async () => { ... };
```

### Service Functions

ALL service functions responsible for backend communication MUST be documented. Documentation MUST include the Purpose, Parameters, Return value (if necessary), and Possible errors.

```tsx
/**
 * Fetches the onboarding path for a specific user.
 *
 * @param userId - Backend ID of the authenticated user.
 * @throws If the backend request fails.
 */
export async function fetchOnboardingPath(userId: string): Promise<OnboardingPath> { ... }
```

---

## 5. Hooks and Effects

### `useEffect` Documentation

Simple effects DO NOT require documentation.
You MUST document effects when:

- They trigger backend communication.
- They synchronize state.
- They depend on multiple conditions.
- Their execution timing is critical to the business logic.

```tsx
useEffect(() => {
  /**
   * Loads the onboarding path once the authenticated user profile is available.
   * The backend requires the user ID to return the correct path.
   */
  const loadPath = async () => { ... };

  if (profile?.id) {
    void loadPath();
  }
}, [profile?.id]);
```

---

## 6. Animation & Theme Documentation

### Framer Motion Boundaries

Document layout transitions, spring tokens, and why `<AnimatePresence>` is used in a specific context.

> [!NOTE]
> The centralized spring-token module is implemented at
> [`src/styles/tokens.ts`](../src/styles/tokens.ts), exporting `centralSpringToken`
> (default layout/list motion) and `hoverSpringToken` (micro-interactions). Use
> these presets for all `motion` transitions — do not inline ad-hoc spring configs.
> See [FRONTEND_ARCHITECTURE.md §8](./FRONTEND_ARCHITECTURE.md#8-animation-system-framer-motion-12)
> for the full animation system.

```tsx
/**
 * AnimatePresence wrapper handles layout transitions as items
 * are deleted from the dashboard list.
 *
 * Utilizes centralized transition config `centralSpringToken` to prevent
 * jittery animations on mobile devices.
 */
<AnimatePresence mode="popLayout">
  {tasks.map((task) => (
    <motion.div
      layout
      exit={{ opacity: 0, scale: 0.9 }}
      transition={centralSpringToken}
      key={task.id}
    >
      <TaskCard task={task} />
    </motion.div>
  ))}
</AnimatePresence>
```

---

## 7. Accessibility & Testing Labels

Interactive components MUST declare labels to support assistive devices and automated tests.

- **`aria-label`**: Required on buttons or links that contain only graphic icons.
- **`data-testid`**: Required on key interactive items (role selections, chat submit buttons) targeted by tests.

```tsx
/**
 * Menu toggle button. Contains only a Lucide icon, requiring
 * an aria-label for screen-reader compliance.
 */
<button onClick={toggleSidebar} aria-label="Toggle navigation menu" data-testid="sidebar-toggle">
  <MenuIcon />
</button>
```

---

## 8. Anti-Patterns: What NOT to Document

> [!CAUTION]
> AI AGENTS: NEVER generate comments for the following trivial scenarios. Doing so degrades code readability.

- **Obvious variable assignments**
- **Simple state updates**
- **Basic JSX markup**
- **Trivial helper functions**
- **Self-explanatory code**

**Bad Example (DO NOT DO THIS)**

```tsx
// Set loading state
setLoading(true);

// Navigate to onboarding page
navigate("/onboarding");
```
