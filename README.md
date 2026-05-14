# SprintStart - AI-Powered Team Onboarding

An enterprise-grade React prototype for streamlined team onboarding, knowledge preservation, and organizational insight. SprintStart helps team members navigate their first days, access vital documentation, and manage handovers through an intuitive, AI-centric interface.

## 🚀 Features

- **Knowledge Explorer:** Advanced document browsing with AI-generated insights, freshness tracking, and interactive metadata filters.
- **AI Assistant:** Chat-based interface for querying internal documentation, runbooks, and ADRs.
- **Multi-language Support:** Full localization for English (Default) and German (DE).
- **Role-Based Perspectives:** Simulated views for New/Existing Project Members, Managers, HR, and Admins.
- **Onboarding Tracking:** Visual progress monitoring through personalized milestones (New Project Member exclusive).
- **Modern Tech Stack:** Built with React 18, Vite, Tailwind CSS v4, and Framer Motion.

## 🛠️ Local Setup

Follow these steps to get the project running on your local machine.

### 1. Prerequisites

Ensure you have the following installed:

- **Node.js:** Latest LTS version (v20+ recommended)
- **Package Manager:** npm (comes with Node) or [pnpm](https://pnpm.io/)

### 2. Installation

Clone the repository and install the dependencies:

```bash
# Clone the repository
git clone <repository-url>
cd sprintstart-frontend


# Install dependencies
npm install
```

_Note: If you encounter peer dependency conflicts, use `npm install --legacy-peer-deps`._

### 3. Running the Development Server

Start the Vite development server:

```bash
npm run dev
```

Once started, open your browser and navigate to `http://localhost:5173`.

### 4. Other Commands

- `npm run build`: Create a production-ready build in the `dist/` folder.
- `npm run lint`: Run ESLint to check for code quality and style issues.
- `npm run format`: Automatically format the codebase using Prettier.
- `npm run preview`: Preview the production build locally.

## 📂 Project Structure

The project follows a modular, screen-based architecture for better scalability:

- `src/app/screens/`: Each major view (Dashboard, AIChat, etc.) lives in its own dedicated folder.
- `src/app/components/`: Shared, reusable UI components.
- `src/app/context/`: Global state management (Role, Theme).
- `src/locales/`: Translation files for i18n support.

## 📖 Documentation

For deeper technical details, architectural decisions, and development conventions, please refer to [GEMINI.md](./GEMINI.md).
