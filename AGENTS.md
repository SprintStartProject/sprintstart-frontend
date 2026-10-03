# AGENTS.md — SprintStart Frontend

Shared, committed entry point for humans and AI agents working in
`sprintstart-frontend`. It does not repeat rules: each topic is written down in
exactly one place, and this file says where. If a link here stops matching reality,
fix it in the same PR.

---

## 1. Where things are documented

- [README.md](./README.md): features, setup, env vars, all npm scripts, Keycloak
  dev users.
- [docs/FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md): tech stack,
  source layout, routing and access control, state and TanStack Query, services and
  SSE, reverse proxy, design-system mechanics, build, deployment, Keycloak login
  theme.
- [docs/FRONTEND_CODING_STANDARDS.md](./docs/FRONTEND_CODING_STANDARDS.md):
  TypeScript, React, styling (palette, UI primitives, radius/shadow/heading scales,
  responsive design), accessibility, animation, services, testing rules, formatting
  and linting.
- [docs/FRONTEND_DOCUMENTATION_GUIDELINES.md](./docs/FRONTEND_DOCUMENTATION_GUIDELINES.md):
  TSDoc and comment rules.
- [docs/testing_strategy.md](./docs/testing_strategy.md): Vitest, MSW, a11y tests,
  test setup and utilities.
- [docs/UI_DESIGN_DECISIONS.md](./docs/UI_DESIGN_DECISIONS.md): why the UI rules
  exist, and the open UI consistency items.

---

## 2. Definition of Done

`npm run try` passes (format check, build, lint, unit and a11y tests), tests of
changed components are updated in the same PR, and new or changed code is documented
per the documentation guidelines. Details in
[FRONTEND_CODING_STANDARDS.md §10](./docs/FRONTEND_CODING_STANDARDS.md#10-enforcement).

---

## 3. Before you start a change

Short pointers to the rules people most often miss. The linked section is the rule;
this list is only a reminder.

- New feature work goes into a `features/<name>/` slice
  ([architecture §3](./docs/FRONTEND_ARCHITECTURE.md#3-source-layout-src)).
- A new protected route needs an `AppRoute` entry and a `routePermissions` entry
  ([architecture §4](./docs/FRONTEND_ARCHITECTURE.md#4-routing--access-control)).
- Use the `ui/` primitives and the palette tokens
  ([coding standards §4](./docs/FRONTEND_CODING_STANDARDS.md#4-styling-tailwind-css-v4)).
- Touching a shared primitive or token? Check the Keycloak login theme's copy
  ([architecture §10.3](./docs/FRONTEND_ARCHITECTURE.md#103-keycloak-login-theme)).

---

## 4. Git & repo boundaries

- Separate repos: `sprintstart-frontend`, `sprintstart-backend`, `sprintstart-ai`,
  `sprintstart-ai-ops`, `sprintstart-k8s`, `Wiki`. Don't assume a shared monorepo
  checkout. The cluster deployment lives in `sprintstart-k8s`
  ([architecture §10.2](./docs/FRONTEND_ARCHITECTURE.md#102-kubernetes)).
- Feature work branches off `dev`; PRs target `dev`.
- Agent instruction files: `AGENTS.md` (this file) is **shared/committed**;
  `GEMINI.md`, `CLAUDE.md`, `AGENTS.local.md`, `GEMINI.local.md` and `CLAUDE.local.md`
  are gitignored (per-developer). Other `*.local.md` files are not ignored.
