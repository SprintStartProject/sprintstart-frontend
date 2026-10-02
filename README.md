# sprintstart-frontend

The web frontend for **SprintStart** — an AI-powered developer onboarding and
knowledge platform. SprintStart helps engineering teams bring new members up to
speed through personalized, AI-generated onboarding paths, an assistant that
answers questions grounded in the team's own knowledge base, and actionable
insights into where documentation is missing.

This repository contains the React single-page application (SPA). It communicates
with the **Spring Boot backend** ([http://localhost:8080](http://localhost:8080)), which
orchestrates business domain events and AI retrieval services, and uses **Keycloak**
([http://localhost:8081](http://localhost:8081)) for identity and access management.

---

## Documentation

This README covers features, setup and commands. Everything else has exactly one
home under `docs/`:

- [FRONTEND_ARCHITECTURE.md](./docs/FRONTEND_ARCHITECTURE.md): tech stack, source
  layout, routing and access control, state and TanStack Query, services, reverse
  proxy, design system, build, deployment, Keycloak login theme.
- [FRONTEND_CODING_STANDARDS.md](./docs/FRONTEND_CODING_STANDARDS.md): TypeScript,
  React, styling and UI primitives, responsive design, accessibility, animation,
  formatting and linting.
- [FRONTEND_DOCUMENTATION_GUIDELINES.md](./docs/FRONTEND_DOCUMENTATION_GUIDELINES.md):
  TSDoc and comment rules.
- [testing_strategy.md](./docs/testing_strategy.md): Vitest, MSW, a11y tests and the
  test setup.
- [UI_DESIGN_DECISIONS.md](./docs/UI_DESIGN_DECISIONS.md): why the UI rules exist,
  and the open UI consistency items.
- [AGENTS.md](./AGENTS.md): short entry point for humans and AI agents.

---

## Features

The application is organized around the following capability areas, each
self-contained under `src/features/` and surfaced through dedicated routes:

- **Dashboard** — The main landing hub featuring onboarding progress, next recommended steps (`NextStepWidget`), and quick access to team and knowledge features.
- **AI Assistant / Chatbot** — A streaming chat interface (Server-Sent Events) that answers questions grounded in the indexed knowledge base. Supports multiple conversations, chat history, and inline **citations** back to the source artifacts (files, lines, PDF pages). Responses render Markdown, syntax-highlighted code blocks, and math (KaTeX).
- **Knowledge Base** — Browse, search, and upload indexed **artifacts** (commits, files, issues, pull requests, documents) ingested from GitHub, Jira, or direct uploads. Each artifact can be summarized on demand via a streamed, citation-backed AI summary.
- **Onboarding** — Personalized, AI-generated onboarding **paths** composed of phases, steps, tasks, and resources (video, document, task, link). Includes phase **knowledge checks** (multiple choice + short-text, AI-graded), a **skip-request** review workflow, step feedback, and phase locking until prerequisites pass.
- **Data Ingestion** — Connect data sources (GitHub, Jira, Confluence, Upload), trigger ingestion runs, track run status (running / completed / partial / failed), inspect failed artifacts, and review run history with pagination.
- **Connectors** — Part of the Data Ingestion page: the project's connectors and their source allow/deny lists. GitHub and Confluence have their own labels and icons, any other connector the backend reports is shown with generic metadata.
- **Team Management** — A project-manager view of the team: onboarding progress, current phase/step, project roles, skills (beginner → expert), and per-user skill assessments. Supports filtering and sorting (progress, step duration) and a per-member detail page. Users rate themselves on the skills linked to their project roles in the **Skill Wizard** (`/skill-wizard`).
- **PM Dashboard** — A project-manager overview surface for monitoring team onboarding trajectories, velocity, and skill acquisition.
- **Admin** — User management (enable/disable, onboarding status, permission groups), project management (sources, members, project managers), and API token management.
- **Insights — Knowledge Gaps** — AI-detected missing documentation per component, with severity (high / medium / low), component owners, and refresh tracking.
- **Insights — FAQ** — AI-generated clusters of frequently asked questions and the documents that answer them.
- **Insights — Knowledge Requests** — Questions escalated by hires, collected in an inbox where PMs answer them.
- **Insights — Onboarding** — Onboarding progress per hire and the hires that need attention.
- **Board** — The hire's own board of cards, areas and stages, synced with the server.
- **AI Buddy** — An AI companion next to the chat that holds a conversation and keeps drafts. It proposes changes the hire confirms first: edits to their board, progress on their onboarding path (completing steps and tasks, answering knowledge checks, adding a step, requesting a skip), and flagging a question to their PM. The onboarding path can open a conversation about a step or question.
- **Blueprints** — Onboarding path blueprints for PMs, edited as a graph and kept in versions.
- **Hire Setup** — Arrival steps and the starter task pool with its review, as tabs of one page.
- **Settings & Profile** — Central configuration page with sections for the user profile (avatar, display name, password), appearance (light/dark/system theme, visual effects and optional extras), and access tokens (GitHub PATs and Atlassian credentials, for authorized roles).
- **Moments & Easter Eggs** — Gamified celebrations (confetti, achievement moments, sound effects) and interactive easter eggs (the dino waiting-game, `2048` behind the dashboard header icon, Space Invaders behind the 404 page's rocket).

---

## Setup Guide

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (the minimum Vite 8 accepts). CI and the
  Docker image use Node 24, which is the safe choice. On Node 25 or newer the tests need a flag,
  see [Local pitfalls](#local-pitfalls).
- npm (the project ships a `package-lock.json` and a `postinstall` hook for Keycloakify)

### Installation

1. Clone the repository and navigate into the project folder:
   ```bash
   cd sprintstart-frontend
   ```
2. Install the project dependencies (this also runs `keycloakify sync-extensions`):
   ```bash
   npm install
   ```

### Environment Variables

Copy `.env.example` to `.env` in the root of `sprintstart-frontend`:

```bash
cp .env.example .env
```

```env
# Keycloak Client ID registered in the 'sprintstart' realm
VITE_KEYCLOAK_CLIENT_ID=sprintstart-frontend
```

> **No URLs to configure.** Requests go to the frontend's own origin and a reverse
> proxy forwards them to the backend (`:8080`) and Keycloak (`:8081`), so both have
> to be running locally. The routes per deployment target are in
> [FRONTEND_ARCHITECTURE.md §6.4](./docs/FRONTEND_ARCHITECTURE.md#64-reverse-proxy).

---

## Commands & Scripts

| Purpose                      | Command                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| **Full DoD Verification**    | `npm run try` (Runs install + format check + build + lint + unit tests + a11y tests)    |
| **Development Server**       | `npm run dev` (Starts Vite dev server at `http://localhost:5173`)                       |
| **Production Build**         | `npm run build` (Runs `tsc -b` + `vite build`)                                          |
| **Preview Production Build** | `npm run preview`                                                                       |
| **Linting**                  | `npm run lint` (ESLint flat config)                                                     |
| **Formatting**               | `npm run format` / `npm run format:check` (Prettier)                                    |
| **All Unit Tests**           | `npm run test` (Vitest non-watch)                                                       |
| **Unit Tests Only**          | `npm run unit` (Excludes a11y tests)                                                    |
| **A11y Tests Only**          | `npm run a11y` (`vitest-axe` WCAG 2.1 AA checks)                                        |
| **Storybook**                | `npm run storybook` (`http://localhost:6006`)                                           |
| **Build Storybook**          | `npm run build-storybook`                                                               |
| **Keycloak Theme Dev**       | `npm run dev-keycloak-theme` (Runs Vite with `VITE_KC_DEV=true` for mock theme preview) |
| **Build Keycloak Theme**     | `npm run build-keycloak-theme` (Builds JAR via Keycloakify & Maven)                     |
| **Docker Full Stack**        | `docker compose up --build` (Nginx container serving SPA at `http://localhost:3000`)    |

### Local pitfalls

Two things fail locally while CI (Linux, Node 24) stays green:

- **Node 25 or newer breaks about 480 tests.** Node brings its own `localStorage`, which is
  undefined without `--localstorage-file` and hides the one jsdom provides. Run the tests with
  the built-in one switched off:

  ```bash
  NODE_OPTIONS=--no-experimental-webstorage npm run test
  ```

- **`npm run format:check` fails on hundreds of files on Windows.** With
  `core.autocrlf=true` Git checks the files out with CRLF, while Prettier expects LF. Git turns
  them back into LF on commit, so nothing wrong reaches the repository, but `npm run try` stops
  at the format check. Switch this clone to LF and check the files out again (only with a clean
  working tree, the second command discards local changes):

  ```bash
  git config core.autocrlf input
  ```

  ```bash
  git rm -r --cached -q . && git reset --hard
  ```

---

## 🛠️ Developer Notes

### 🔑 Authentication & User Setup

The application uses **Keycloak** for Identity and Access Management. When developing locally against a live backend stack:

1. **Access Keycloak Admin**: Go to [http://localhost:8081/auth/admin](http://localhost:8081/auth/admin) (or [http://localhost:8081/admin](http://localhost:8081/admin)).
   - **Username**: `admin`
   - **Password**: `admin`
2. **Create / Inspect User**:
   - Switch to the **`sprintstart`** realm.
   - Navigate to **Users** -> **Add user**.
   - In the **Credentials** tab, set a password and disable **Temporary**.
3. **Assign Roles**:
   - Go to the user's **Role mapping** tab -> **Assign role**.
   - Filter by realm roles and assign the appropriate role for testing:
     - `USER` — The hire's surfaces: dashboard, onboarding, chat, AI buddy, board, knowledge
       base and settings.
     - `PM` — Everything `USER` has, plus the PM workspace (PM dashboard, team management,
       insights), data ingestion, blueprints and hire setup. All of these except hire setup
       are only open for a project the PM manages.
     - `HR` — The same pages as `PM`, without the project-manager check, plus the admin page.
       Some of them are read-only for HR (answering knowledge requests, acting in hire setup).
     - `ADMIN` — Everything, including the admin-only project actions (industry, assigning a
       project manager, deleting a project).
   - The skill wizard (`/skill-wizard`) is open to every role. `AuthGuard` sends a user there
     when their project roles have skills they have not assessed yet.
   - Which role may open which route is defined in `src/auth/accessPolicy.ts`.
4. **Log In**: Open [http://localhost:5173](http://localhost:5173). You will be redirected to the Keycloak login screen, authenticate, and return to the application.
