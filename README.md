# sprintstart-frontend

Frontend dashboard and onboarding interface for the SprintStart platform.

## Prerequisites
- Node.js 18+
- npm
- Docker (optional)

## Setup and Development

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
The application runs at http://localhost:5173. API calls are proxied to http://127.0.0.1:8080.

### Docker
```bash
docker compose up --build
```
The application runs at http://localhost:3000.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite development server |
| `npm run build` | Compiles and builds for production |
| `npm run lint` | Runs ESLint for code quality |
| `npm run test` | Runs unit tests via Vitest |
| `npm run test:ui` | Opens Vitest UI |
| `npm run preview` | Previews the production build |

## Tech Stack
- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4
- Vitest & React Testing Library
- Framer Motion
