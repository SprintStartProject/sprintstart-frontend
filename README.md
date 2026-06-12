# sprintstart-frontend

Frontend dashboard and onboarding interface for the SprintStart platform.

## Prerequisites
- Node.js 20+
- npm
- Playwright (`npx playwright install chromium`)

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
Tip: Use `testuser` as username to bypass backend authentication.

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
| `npm run lint` | Runs ESLint and TypeScript checks |
| `npm run tests` | Runs all tests (Unit + A11y) |
| `npm run unit` | Runs unit tests via Vitest |
| `npm run a11y` | Runs WCAG AA accessibility scans |