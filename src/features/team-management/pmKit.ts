/**
 * What the roles tab takes from the PM area and from the project selection, in one place.
 *
 * Neither feature exposes an `index.ts` yet, so every role module takes it from here: the coupling
 * is one list instead of one import per file. When they get a public entry point, this file is the
 * only one that changes.
 */
export { PmFilterChip, PmListToolbar } from "../pm-area/components/PmListToolbar.tsx";
export { useProjectContext } from "../projects";
