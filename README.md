# sprintstart-frontend

The web frontend for **SprintStart** — an AI-powered developer onboarding and
knowledge platform. SprintStart helps engineering teams bring new members up to
speed through personalized, AI-generated onboarding paths, an assistant that
answers questions grounded in the team's own knowledge base, and actionable
insights into where documentation is missing.

This repository contains the React single-page application (SPA). It communicates
with a separate [backend](http://localhost:8080) API and an AI service, and uses
**Keycloak** for identity and access management.

---

## Tech Stack

| Area | Technology |
| --- | --- |
| UI framework | **React 19** |
| Routing | **React Router v7** |
| Language | **TypeScript** (strict) |
| Build tooling | **Vite 8** |
| Styling | **Tailwind CSS v4** (semantic design tokens, light/dark themes) |
| Animation | **Framer Motion 12** (centralized spring tokens) |
| Authentication | **Keycloak** via `keycloak-js`, with a custom login theme built on **Keycloakify 11** |
| Markdown / math rendering | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter` |
| Icons | `lucide-react` |
| Unit testing | **Vitest 4** + **Testing Library** (`jsdom`, `msw`, `vitest-axe`) |
| Component dev | **Storybook 10** |
| Linting / formatting | **ESLint 9** (flat config: `typescript-eslint`, `react`, `react-hooks`, `jsx-a11y`, `prettier`) |

> The project pins a custom Keycloak login theme. Running `npm install`
> automatically executes `keycloakify sync-extensions` (see `postinstall`).

---

## Features

The application is organized around the following capability areas, each
self-contained under `src/features/` and surfaced through dedicated routes:

- **AI Assistant / Chatbot** — A streaming chat interface (Server-Sent Events)
  that answers questions grounded in the indexed knowledge base. Supports
  multiple conversations, chat history, and inline **citations** back to the
  source artifacts (files, lines, PDF pages). Responses render Markdown, code
  blocks, and math (KaTeX).
- **Knowledge Base** — Browse and search indexed **artifacts** (commits, files,
  issues, pull requests) ingested from GitHub, Jira, or direct uploads. Each
  artifact can be summarized on demand via a streamed, citation-backed AI
  summary.
- **Onboarding** — Personalized, AI-generated onboarding **paths** composed of
  phases, steps, tasks, and resources (video, document, task, link). Includes
  phase **knowledge checks** (multiple choice + short-text, AI-graded), a
  **skip-request** review workflow, step feedback, and phase locking until
  prerequisites pass.
- **Data Ingestion** — Connect data sources (GitHub, Jira, Upload), trigger
  ingestion runs, track run status (running / completed / partial / failed), and
  inspect failed artifacts. Artifacts are browsable with pagination.
- **Connectors** — Manage project connectors and their source allow/deny lists
  (GitHub today, extensible to Jira).
- **Team Management** — A project-manager view of the team: onboarding
  progress, current phase/step, project roles, skills (beginner → expert), and
  per-user skill assessments. Supports filtering and sorting (progress, step
  duration) and a per-member detail page.
- **PM Dashboard** — A project-manager overview surface for monitoring team
  progress.
- **Admin** — User management (enable/disable, onboarding status, permission
  groups), project management (sources, members), API token management, and
  authoring of phase-check questions/options plus attempt review.
- **Insights — Knowledge Gaps** — AI-detected missing documentation per
  component, with severity (high / medium / low), component owners, and
  refresh tracking.
- **Insights — FAQ** — AI-generated clusters of frequently asked questions and
  the documents that answer them.
- **Skill Wizard** — Create and edit skills linked to project roles.
- **Profile** — View and edit the current user's profile.

---

## Architecture

The codebase follows a **feature-first** organization: domain code lives in
`src/features/<name>/` (each with its own `components/`, optional `hooks/`, and
`types.ts`), while only genuinely shared code lives in the top-level folders.

```
src/
├── features/        # Self-contained domain slices
│   ├── admin/           # User, project & token management
│   ├── chatbot/         # Streaming AI assistant (useChat hook)
│   ├── connectors/      # Connector + source allow/deny management
│   ├── data-ingestion/  # Sources, ingestion runs, artifacts
│   ├── faq/             # AI FAQ clusters (insights)
│   ├── knowledge-base/  # Artifact browsing + streamed summaries
│   ├── knowledge-gaps/  # AI-detected documentation gaps (insights)
│   ├── onboarding/      # AI onboarding paths, checks, skip workflow
│   ├── profile/         # User profile
│   ├── projects/        # Project selection
│   └── team-management/ # Team overview & member detail
├── pages/           # Route-level views (one per user-facing flow)
├── router/          # React Router v7 config + AuthGuard
├── auth/            # Access policy (AppRoute union, canAccessRoute)
├── context/         # Global providers (AuthProvider, ThemeProvider)
├── services/        # Backend communication (one module per domain; SSE streaming)
├── components/      # Shared UI: common/, layout/, ui/ primitives
├── config/          # Integration config (keycloak.ts)
├── hooks/           # Shared hooks
├── styles/          # Global CSS + semantic design tokens
├── mocks/           # Dev mock data
└── keycloak-theme/  # Keycloakify overrides (kc.gen.tsx is generated — do not hand-edit)
```

**Key conventions**

- **Routing & access control** — Protected routes are wrapped in `AuthGuard`;
  route access is centralized in `auth/accessPolicy.ts` (`AppRoute` union +
  `canAccessRoute`). New protected routes must be registered there or they
  won't be access-controlled.
- **API layer** — All backend communication goes through `src/services/`
  (typed responses; SSE for streaming). The dev server proxies `/api`, `/v1`
  → `http://127.0.0.1:8080` (backend) and `/auth` → `http://127.0.0.1:8081`
  (Keycloak).
- **Design system** — One shared semantic palette (CSS variables → Tailwind
  `app-*` classes) defined in `src/styles/index.css`. Always use tokens, never
  hardcode colors. Light/dark via the `.dark` class managed by `ThemeProvider`.
- **Accessibility** — Targets WCAG 2.1 AA; meaning is never conveyed by color
  alone (icons + labels back every status). E2E-targeted elements declare
  `data-testid`.

---

## Setup Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
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

Create a `.env` file in the root of the `sprintstart-frontend` directory with the
following configuration (see `.env.example`):

```env
# Keycloak Configuration
VITE_KEYCLOAK_AUTHORITY=http://localhost:8081/auth/realms/sprintstart
VITE_KEYCLOAK_CLIENT_ID=sprintstart-frontend
# 5173 if started with npm run dev
VITE_KEYCLOAK_REDIRECT_URI=http://localhost:3000
```

### Development

To start the local development server, run:

```bash
npm run dev
```

The application will be accessible in your browser at: **http://localhost:5173/**


### One Command Start

To start the local deployment via docker compose in command, run:

```bash
docker compose up --build
```

The application will be accessible in your browser at: **http://localhost:3000/**

---

## 🛠️ Developer Notes

### 🔑 Authentication & User Setup

The application uses **Keycloak** for Identity and Access Management. There are two ways to get started:

#### Option A: Create a Real User (Full Flow)

To test the full login experience:
1.  **Access Keycloak Admin**: Go to [http://localhost:8081](http://localhost:8081/admin).
    *   **Username**: `admin`
    *   **Password**: `admin` (or as set in your `.env`)
2.  **Create User**:
    *   Switch to the `sprintstart` realm.
    *   Go to **Users** -> **Add user**.
    *   After creating, go to the **Credentials** tab and set a password (turn off "Temporary").
3.  **Role Assignment**: Go to the **Role mapping** tab.
    *   **For regular users**: Ensure the user has the `USER` role.
    *   **For administrators**: Click **Assign role**, change the filter dropdown to **Filter by realm roles**, select `ADMIN`, and save.
4.  **Login**: Now, when you open the frontend, you will be redirected to the Keycloak login page (8081). Once logged in, it will redirect back to the app, which then communicates with the **Backend** ([http://localhost:8080](http://localhost:8080)).
