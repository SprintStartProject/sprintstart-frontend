# SprintStart Architecture

This document describes the architectural patterns, folder structure, and core logic of the SprintStart project. It serves as a guide for developers and AI agents to ensure new features align with the established system design.

---

## 1. Directory Structure (`src/app/`)

The project follows a modular, domain-driven structure to ensure scalability and separation of concerns.

### `components/` (Reusable UI)
Contains atomic and molecular UI components that are agnostic of domain logic.
- **Examples:** `ProgressBar.tsx`, `MetricCard.tsx`, `ThemeProvider.tsx`.
- **Subdirectories:** Use subdirectories for complex systems like `navigation/` (Sidebar, Topbar).

### `screens/` (Domain-Specific Pages)
The core of the application features. Each major "page" or feature set lives here.
- **Pattern:** Each screen has its own folder containing the main component (e.g., `Dashboard.tsx`), a local `index.ts` for clean exports, and any screen-specific types or mock data (e.g., `mockData.ts`).
- **Example:** `src/app/screens/Knowledge/` contains the logic, types, and styles specifically for the Knowledge Base.

### `views/` (High-Level Layouts & Special Pages)
High-level views that often combine multiple components or serve as special entry points.
- **Example:** `ChatHome.tsx` is a specialized view that serves as the application's landing experience.
- **Example:** `PlaceholderView.tsx` acts as a fallback for unimplemented features.

### `context/` (Global State)
Centralized state providers that wrap the application.
- **RoleContext:** Manages simulated user identities and permissions.
- **ThemeProvider:** Manages light/dark mode state.

---

## 2. Routing Logic

Routing is centralized in `src/app/App.tsx` using **React Router v7** (`createBrowserRouter`).

### Centralized Config
- The `navigationItems` array in `src/app/components/navigation/NavigationConfig.tsx` acts as the single source of truth for all routes.
- Each item defines its `path`, `icon`, and the `roles` allowed to access it.

### Dynamic Route Generation
- `App.tsx` maps the `navigationItems` to their respective screen components using a `SCREEN_MAP`.
- This ensures that adding a new page only requires adding an entry to the navigation config and the screen map.

---

## 3. Role-Based Access Control (RBAC)

SprintStart uses a simulated RBAC system via `RoleContext` to demonstrate multi-persona workflows without a backend. This is a **Demo Perspective** feature designed to show stakeholders how the app transforms for different users.

### The "Perspective Switcher"
- Located in the Sidebar footer, it allows instant switching between roles.
- **Side Effect:** Switching roles triggers a global navigation reset to `/` to ensure the user lands on a screen they are guaranteed to have permission for (the Chat).
- **"Show all" Perspective:** A special administrative/developer role that bypasses all filters and displays every navigation zone (Base, PM, HR, Admin) simultaneously for rapid prototyping and testing.

### Navigation Config: The "Brain"
The `src/app/components/navigation/NavigationConfig.tsx` is the most critical file for adding features:
- **Centralized Logic:** By defining a route's `roles` and `section` here, you automatically control its visibility in the Sidebar and its accessibility in the Router.
- **Zone Filtering:** The Sidebar dynamically renders items into "Zones" (Project Management, HR, Admin) based on the `section` property, but only if the current role is included in the `roles` array.

---

## 4. State Management Strategy

### Context Providers
- **RoleContext:** Central source for the `UserRole`. Any component can use the `useRole` hook to adapt its UI (e.g., the `Admin` screen mock users).
- **ThemeProvider:** Handles the `light` | `dark` toggle, persisted in the browser's root class list.

### Mock Data Strategy
To maintain a high-fidelity feel without a database:
- Each screen should have a companion `mockData.ts` file.
- Use `useMemo` to filter or transform this data based on the current role or search queries to simulate real-time API responses.

---

## 5. Responsive UI Strategy

The application follows a mobile-first responsive strategy, adapting complex desktop patterns for smaller touchscreens.

### Layout Transformations
- **Tables to Cards:** Screens like `SkillGaps` and `Knowledge` transform desktop data tables into card-based lists on mobile to ensure readability and ease of touch.
- **Space-Saving Headers:** Major features like the Knowledge search bar are moved behind toggle buttons on mobile to preserve vertical space for content.
- **Z-Index Layering:** Mobile navigation is assigned the highest priority (`z-50` to `z-60`) to ensure sidebars and headers always sit above screen-specific overlays (which default to `z-40`).
