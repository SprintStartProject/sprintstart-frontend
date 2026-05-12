# Plan: Knowledge Base Screen Upgrades

This plan outlines the enhancements for the Knowledge Base screen to improve AI integration, localization, UX, and functional depth.

## Background
The current `Knowledge.tsx` is a functional but basic prototype with hardcoded data and strings. It lacks the "AI-powered" feel and localization support present in other parts of the application.

## Scope
- **Data:** Decouple mock data and expand the model (AI summaries, more items).
- **i18n:** Full localization (EN/DE) for all UI strings.
- **UX:** Framer Motion animations for the preview panel and results list.
- **AI Integration:** Simulated AI actions (Ask AI, Summarize).
- **Functionality:** Advanced filtering (by owner) and operational actions (Share, Update).

## Proposed Changes

### 1. Data Layer (`src/app/screens/Knowledge/mockData.ts`)
- Define `KnowledgeItem` interface.
- Create `mockKnowledgeItems` array.
- Add `aiSummary` field.

### 2. Localization (`src/locales/{en,de}/translation.json`)
- Add `knowledge` section to translation files.
- Keys for search, filters, metadata labels, and actions.

### 3. UI Component (`src/app/screens/Knowledge/Knowledge.tsx`)
- **Search & Filters:** Add "Owner" filter.
- **Results:** 
    - Add Framer Motion `layout` and `initial/animate` for items.
    - Add `EmptyState` sub-component.
- **Preview Panel:**
    - Use `AnimatePresence` for smooth slide-in.
    - Add "Ask AI" button (simulated interaction).
    - Add "Request Update" and "Share" buttons.
    - Display `aiSummary`.

## Execution Steps

1. **Step 1: Data Migration**
    - Create `mockData.ts`.
    - Export `KnowledgeItem` and `mockKnowledgeItems`.
2. **Step 2: i18n Setup**
    - Update English and German translation files with new keys.
3. **Step 3: Component Refactoring**
    - Import `useTranslation`.
    - Implement `AnimatePresence` for the preview panel.
    - Add AI actions and operational buttons.
    - Add the new "Owner" filter logic.
    - Implement `EmptyState` for zero results.
4. **Step 4: Verification**
    - Verify layout responsiveness.
    - Test filter combinations.
    - Check language switching (EN <-> DE).

## Success Criteria
- [ ] No hardcoded strings in the UI.
- [ ] Preview panel slides in smoothly.
- [ ] AI-specific actions are visible and interactive.
- [ ] User can filter by Type, Freshness, and Owner.
- [ ] Empty state is shown when no results match.
