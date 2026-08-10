# sprintstart-frontend — prime-agent & Development Rules

## Post-Work Checklist (MANDATORY — run after every change)
Run these three commands in order and fix all new errors before committing:

```powershell
npm run build
npm run lint
npx vitest run tests/unit/features/knowledge-base/components/ArtifactViewerDrawer.test.tsx
```

## Key Conventions & Principles
1. **Named exports** everywhere except lazy-loaded route pages.
2. **`import type`** for all type imports (`verbatimModuleSyntax: true`).
3. **`app-*` semantic tokens** for all colors — never hardcode hex or raw Tailwind colors.
4. **Centralized spring tokens** from `src/styles/tokens.ts` for Framer Motion.
5. **Merge conflicts:** strip `bg-app-bg` from `<main>` — it blocks the AuroraBackground.
6. **No `any`**, no `@ts-ignore`, no `console.log` in production code.
7. **Commit style:** plain English imperative sentence (e.g. "Add JSON error message parsing to apiClient").
