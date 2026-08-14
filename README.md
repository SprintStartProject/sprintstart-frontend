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

## Tech Stack

| Area                      | Technology                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| UI framework              | **React 19**                                                                                    |
| Routing                   | **React Router v7**                                                                             |
| Language                  | **TypeScript** (strict, `verbatimModuleSyntax`)                                                 |
| Build tooling             | **Vite 8** (`@vitejs/plugin-react`, `@tailwindcss/vite`)                                        |
| Styling                   | **Tailwind CSS v4** (semantic design tokens, light/dark themes via `ThemeProvider`)             |
| Animation                 | **Framer Motion 12** (centralized spring tokens, `<AnimatePresence>`)                           |
| Authentication            | **Keycloak** via `keycloak-js`, with a custom login theme built on **Keycloakify 11**           |
| Markdown / math rendering | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter`       |
| Icons                     | `lucide-react`                                                                                  |
| Unit testing              | **Vitest 4** + **Testing Library** (`jsdom`, `msw` ^2.14, `vitest-axe`)                         |
| Component dev             | **Storybook 10**                                                                                |
| Linting / formatting      | **ESLint 9** (flat config: `typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`, `prettier`) |

> The project pins a custom Keycloak login theme. Running `npm install`
> automatically executes `keycloakify sync-extensions` (see `postinstall`).

---

## Features

The application is organized around the following capability areas, each
self-contained under `src/features/` and surfaced through dedicated routes:

- **Dashboard** — The main landing hub featuring onboarding progress, next recommended steps (`NextStepWidget`), and quick access to team and knowledge features.
- **AI Assistant / Chatbot** — A streaming chat interface (Server-Sent Events) that answers questions grounded in the indexed knowledge base. Supports multiple conversations, chat history, and inline **citations** back to the source artifacts (files, lines, PDF pages). Responses render Markdown, syntax-highlighted code blocks, and math (KaTeX).
- **Knowledge Base** — Browse, search, and upload indexed **artifacts** (commits, files, issues, pull requests, documents) ingested from GitHub, Jira, or direct uploads. Each artifact can be summarized on demand via a streamed, citation-backed AI summary.
- **Onboarding** — Personalized, AI-generated onboarding **paths** composed of phases, steps, tasks, and resources (video, document, task, link). Includes phase **knowledge checks** (multiple choice + short-text, AI-graded), a **skip-request** review workflow, step feedback, and phase locking until prerequisites pass.
- **Data Ingestion** — Connect data sources (GitHub, Jira, Upload), trigger ingestion runs, track run status (running / completed / partial / failed), inspect failed artifacts, and review run history with pagination.
- **Connectors** — Manage project connectors and their source allow/deny lists (GitHub, extensible to Jira).
- **Team Management** — A project-manager view of the team: onboarding progress, current phase/step, project roles, skills (beginner → expert), and per-user skill assessments. Supports filtering and sorting (progress, step duration) and a per-member detail page. Includes the **Skill Wizard** (`/skill-wizard`) for authoring skills linked to project roles.
- **PM Dashboard** — A project-manager overview surface for monitoring team onboarding trajectories, velocity, and skill acquisition.
- **Admin** — User management (enable/disable, onboarding status, permission groups), project management (sources, members, project managers), API token management, and authoring of phase-check questions/options plus attempt review.
- **Insights — Knowledge Gaps** — AI-detected missing documentation per component, with severity (high / medium / low), component owners, and refresh tracking.
- **Insights — FAQ** — AI-generated clusters of frequently asked questions and the documents that answer them.
- **Settings & Profile** — Central configuration hub with tabs for user profile management (avatar, display name, password update), appearance (light/dark/system theme), chat preferences, moments toggles, and access tokens (GitHub PAT / Jira credential management for authorized roles).
- **Moments & Easter Eggs** — Gamified celebrations (confetti, achievement moments, sound effects) and interactive easter eggs (`dino`, `game2048`, `space-invaders`).

---

## Architecture

The codebase follows a **feature-first** organization: domain code lives in
`src/features/<name>/` (each with its own `components/`, optional `hooks/`, and
`types.ts`), while only genuinely shared code lives in the top-level folders.

```
src/
├── features/            # Self-contained domain slices
│   ├── admin/           # User, project & token management
│   ├── chatbot/         # Streaming AI assistant (SSE prompt stream)
│   ├── connectors/      # Connector + source allow/deny management
│   ├── dashboard/       # Dashboard hero & NextStepWidget
│   ├── data-ingestion/  # Sources, ingestion runs, artifact tables
│   ├── dino/            # Dino easter-egg mini game
│   ├── easter-eggs/     # Easter-egg trigger hooks & modals
│   ├── faq/             # AI FAQ clusters (insights)
│   ├── game2048/        # 2048 easter-egg mini game
│   ├── knowledge-base/  # Artifact browsing + streamed summaries + file upload
│   ├── knowledge-gaps/  # AI-detected documentation gaps (insights)
│   ├── moments/         # Celebrations, confetti, rocket animations
│   ├── onboarding/      # AI onboarding paths, knowledge checks, skip workflow
│   ├── profile/         # Profile form components
│   ├── projects/        # Multi-project switching & global ProjectContext
│   ├── settings/        # User settings tabs, themes & credentials
│   ├── space-invaders/  # Space Invaders easter-egg mini game
│   └── team-management/ # Team overview, member detail, Skill Wizard
├── pages/               # Route-level views (one per user-facing flow)
├── router/              # React Router v7 config + AuthGuard
├── auth/                # Access policy (AppRoute union, canAccessRoute)
├── context/             # Global providers (AuthProvider, ThemeProvider, ChatProvider)
├── services/            # Backend communication (one module per domain; SSE streaming via sse.ts)
├── components/          # Shared UI: common/, layout/, ui/ primitives
├── config/              # Integration config (keycloak.ts)
├── hooks/               # Shared hooks
├── styles/              # Global CSS + semantic design tokens + centralized spring tokens
├── mocks/               # Dev mock datasets and fallback fixtures
└── keycloak-theme/      # Keycloakify overrides (kc.gen.tsx is generated — do not hand-edit)
```

**Key conventions**

- **Routing & access control** — Protected routes are wrapped in `AuthGuard`;
  route access is centralized in `auth/accessPolicy.ts` (`AppRoute` union +
  `canAccessRoute`). Four permission groups are enforced: `USER`, `PM`, `HR`, and `ADMIN`.
- **API layer & proxying** — All backend communication goes through `src/services/`
  (typed responses; SSE for streaming). The Vite dev server proxies `/api`, `/v1`
  → `http://127.0.0.1:8080` (backend) and `/auth` → `http://127.0.0.1:8081`
  (Keycloak). In Docker production, Nginx handles the identical reverse proxy routing.
- **Design system** — One shared semantic palette (CSS variables → Tailwind
  `app-*` classes) defined in `src/styles/index.css`. Always use tokens, never
  hardcode colors. Light/dark is controlled via the `.dark` class managed by `ThemeProvider`.
- **Accessibility** — Targets WCAG 2.1 AA; meaning is never conveyed by color
  alone (icons + labels back every status). E2E-targeted elements declare
  `data-testid`.

---

## Setup Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher recommended)
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

> **Note on Reverse Proxying:**
> You do not need to configure API or Keycloak authority URLs. Both Vite (`npm run dev`)
> and Nginx (`docker compose up`) automatically reverse-proxy:
>
> - `/api` & `/v1` → `http://127.0.0.1:8080` (Spring Boot backend)
> - `/auth` → `http://127.0.0.1:8081` (Keycloak IAM)

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
     - `USER` — Standard developer onboarding and chat access.
     - `PM` — Project Manager (access to PM dashboard, team management, skill wizard, data ingestion).
     - `HR` — Human Resources (team management, project overview).
     - `ADMIN` — System Administrator (full user/project management, token configuration, system administration).
4. **Log In**: Open [http://localhost:5173](http://localhost:5173). You will be redirected to the Keycloak login screen, authenticate, and return to the application.

---

## Testing & Mocking Strategy

- **HTTP Mocking in Tests**: Unit and component tests use **MSW (Mock Service Worker)** via `setupServer` in `tests/unit/setup/msw-handlers.ts` to intercept `fetch` and SSE streams.
- **Service Resilience**: Services are designed with graceful fallback handling to allow UI development to proceed smoothly even when backend modules are evolving.
- For complete details on testing conventions, coverage expectations, and axe-core rules, consult [docs/testing_strategy.md](./docs/testing_strategy.md).
