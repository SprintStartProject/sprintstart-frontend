# SprintStart - AI-Powered Team Onboarding & Knowledge Management

SprintStart is a visually-driven React prototype designed to streamline team onboarding, knowledge preservation, and organizational insight. It leverages an AI-centric interface to help team members find documentation, track their progress, and manage handovers effectively.

## Project Overview

- **Purpose:** A centralized hub for team onboarding (Day 1, Week 1, Month 1), knowledge base access, and role-specific dashboards.
- **Key Features:**
  - **Knowledge Explorer:** Advanced document management with AI-generated summaries, freshness tracking (Current/Stale/Outdated), and smooth animated previews. Features a mobile-optimized UI with toggleable search and side-by-side dropdown filters.
  - **AI Assistant:** Chat-based interface for querying internal documentation, runbooks, and ADRs.
  - **Multi-language Support (i18n):** Full support for English (Default) and German (DE) across the interface and mock content.
  - **Role-Based Views:** Tailored experiences for New Project Members, Existing Project Members, Project Managers, HR, and Admins.
  - **Onboarding Tracking:** Progress monitoring through personalized milestones, exclusive to New Project Members.
  - **Knowledge Quality:** Analytics on content freshness and engagement.
  - **Handover Management:** Tools for smooth knowledge transfers during transitions.
- **Tech Stack:**
  - **Frontend:** React (TypeScript), Vite
  - **i18n:** i18next, react-i18next
  - **Styling:** Tailwind CSS (v4)
  - **Routing:** React Router (v7)
  - **Icons:** Lucide-React
  - **Motion:** Framer Motion (motion)
  - **State Management:** React Context (RoleContext, ThemeProvider)

## Building and Running

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or pnpm

### Commands

- **Install Dependencies:** `npm install` (Use `--legacy-peer-deps` if peer conflicts occur)
- **Development Server:** `npm run dev` (Runs the Vite dev server)
- **Build:** `npm run build`
- **Preview Production Build:** `npm run preview`
- **Lint:** `npm run lint` (Checks for code quality issues using ESLint v9)
- **Format:** `npm run format` (Automatically formats code using Prettier)

## Internationalization (i18n)

The project uses `i18next` and `react-i18next` for translations.

- **Language Switcher:** Located in the Sidebar footer.
- **Translation Files:** Found in `src/locales/`.
- **Default Language:** English (EN).
- **Adding Languages:** Add a new JSON file in `src/locales/` and register it in `src/i18n.ts`.

## Project Structure

- `index.html`: Main HTML entry point.
- `src/main.tsx`: React application entry point and mounting logic.
- `src/i18n.ts`: i18n configuration and setup.
- `src/locales/`: Translation resources (EN/DE).
- `src/app/`: Main application logic.
  - `components/`: Reusable UI components.
    - `navigation/`: Sidebar and navigation configuration.
  - `context/`: Global state providers (Role, Theme).
  - `screens/`: Domain-specific screens. Each screen has its own folder with an `index.ts` entry point (e.g., `screens/Dashboard/Dashboard.tsx`).
  - `views/`: High-level page layouts (ChatHome, PlaceholderView).
- `src/styles/`: Global CSS, Tailwind configuration, and theme definitions.
- `src/imports/`: Assets like layout images.

## Development Conventions

- **Component Pattern:** Functional components with TypeScript.
- **Styling:** Utility-first CSS using Tailwind.
- **Icons:** Use `lucide-react` for all system icons.
- **Routing:** Centralized routing in `src/app/App.tsx` using `createBrowserRouter`.
- **Role Simulation:** The application uses `RoleContext` to simulate different user perspectives. Switching roles via the Sidebar resets the navigation to the main Chat screen (`/`).
- **Role Permissions:**
  - **New Project Member**: Access to Base Zone + Onboarding.
  - **Existing Project Member**: Access to Base Zone only.
  - **Project Manager**: Access to Base Zone + PM Zone.
  - **HR**: Access to Base Zone + HR Zone.
  - **Admin**: Access to Base Zone + Admin Zone.
  - **Show all**: Comprehensive access to all Zones simultaneously for development and demo purposes.
- **AI UI:** The `ChatHome` component follows a specific layout for messages, citations, and filtering.

## Design Resources

- **Sprint Layout:** Reference `Sprint Layout.png` for the intended visual design and hierarchy.
