# Frontend Documentation Guidelines

This document defines the strict documentation standards for the React and TypeScript frontend codebase.

> [!IMPORTANT]
> **AI AGENT DIRECTIVE**: As an AI agent working in this codebase, you MUST adhere strictly to these rules. Do not over-document. Do not explain standard React/TS syntax. Only provide comments that explain the **Why** and the **Business Context**.

> **Related docs**
>
> - [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) — system architecture (routing, services, state, design system, animation).
> - [FRONTEND_CODING_STANDARDS.md](./FRONTEND_CODING_STANDARDS.md) — coding rules, including accessibility labels and `data-testid` (§5) and animation (§6).
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

You MUST document all page-level or view-level components. Describe the view's responsibility, the user flow it belongs to, its route context, and the backend, auth, routing or state dependencies it relies on.

Start with what the view is for. Don't open with the component name, it is already
on the line below.

```tsx
/**
 * The hire's onboarding path, shown either as a list of phases or as the journey graph.
 *
 * Bound to `/onboarding` and `/onboarding/:stepId`. `AuthGuard` blocks both once the
 * user has completed onboarding. Generating a path is not this page's job:
 * `OnboardingJourneyProvider` owns it, so leaving the page does not cancel it.
 */
export function OnBoardingPage() { ... }
```

### Reusable UI Components

Document reusable components when their purpose or usage context is not immediately obvious. Document intended use cases, responsive boundaries, and specific layout states. Small presentational components with self-explanatory names do not require documentation.

```tsx
/**
 * Summary card for an onboarding task inside the onboarding phase dashboard.
 *
 * Reused in the hire's own view and in the PM's member detail, so it must not assume
 * that the viewer is the hire.
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
- The prop value must follow backend or auth-related constraints.

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

How routing and the guards work is described in
[FRONTEND_ARCHITECTURE.md §4](./FRONTEND_ARCHITECTURE.md#4-routing--access-control).

Document route components with their route path, the `AppRoute` literal they
correspond to in `src/auth/accessPolicy.ts`, the permission groups allowed to
access them, and which guard enforces that. `AuthGuard` only handles login, the
skill-assessment redirect and the onboarding block; role and project checks by URL
are done by `ManagerAreaGuard` in `AppRouter.tsx`, and only for the routes wrapped
in it.

```tsx
/**
 * The selected project's sources, their connectors and their ingestion runs.
 *
 * Bound to `/data-ingestion`, open to `PM`, `HR` and `ADMIN` (`routePermissions` in
 * `src/auth/accessPolicy.ts`). The route is wrapped in `ManagerAreaGuard`, which
 * additionally requires a PM to manage the selected project and otherwise redirects
 * to `getDefaultRoute(profile)`.
 */
export function DataIngestionPage() { ... }
```

For sub-routes with dynamic params, document the param shape and where the value
comes from:

```tsx
/**
 * One hire's progress, roles and skills, for the people who manage them.
 *
 * Rendered by `PmWorkspace` for `/team/:userId`; the workspace reads the param and
 * passes it in as `userId`, so this page never calls `useParams()` itself.
 */
export function TeamMemberDetailPage({ userId }: { userId?: string }) { ... }
```

---

## 4. Functions and Business Logic

Functions MUST be documented whenever they contain business logic or behavior that is not immediately obvious. That includes:

- Permission or role rules.
- Conditional user flows.
- Data transformations.
- Backend contract assumptions.
- Error handling decisions.
- Temporary limitations or known backend gaps.

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

### Custom hooks

Document a custom hook when it encapsulates business behavior, backend calls,
authorization state, routing behavior, or non-trivial state synchronization.

### `useEffect` Documentation

Simple effects DO NOT require documentation.
You MUST document effects when:

- They trigger backend communication.
- They synchronize state.
- They depend on multiple conditions.
- Their execution timing is critical to the business logic.

An effect is not an exported symbol, so it gets a plain comment above it, not a TSDoc
block:

```tsx
// Waits for the profile: the backend needs the user ID to return the right path.
useEffect(() => {
  if (!profile?.id) return;
  void loadPath(profile.id);
}, [profile?.id]);
```

---

## 6. Animation & Theme Documentation

### Framer Motion Boundaries

Document layout transitions, spring tokens, and why `<AnimatePresence>` is used in a specific context.

Which tokens to use and how to set up `<AnimatePresence>` is in
[FRONTEND_CODING_STANDARDS.md §6](./FRONTEND_CODING_STANDARDS.md#6-animation-framer-motion-12).
The comment explains the choice the rule leaves open, such as why a list uses
`popLayout`. Inside JSX it has to be written as `{/* ... */}`:

```tsx
<div className="grid gap-4">
  {/* popLayout lets the remaining cards close the gap while a deleted one is still
      animating out, instead of jumping once the exit has finished. */}
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
</div>
```

---

## 7. Anti-Patterns: What NOT to Document

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
