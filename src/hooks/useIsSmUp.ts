import { useMediaQuery } from "./useMediaQuery";

/** Tailwind's `sm` breakpoint, the one width the app branches on in JS. */
const SM_UP_QUERY = "(min-width: 640px)";

/**
 * Whether the viewport is at least Tailwind's `sm` width (640px).
 *
 * The single place the `sm` breakpoint is expressed in JS, for the few spots
 * that must branch on it in behaviour rather than in CSS: the Starter Work pool
 * falls back from its cloud to a plain list below `sm`, and the hover-revealed
 * quick actions on the review cards and issue rows are shown outright below `sm`,
 * where there is no pointer to hover with.
 */
export function useIsSmUp(): boolean {
  return useMediaQuery(SM_UP_QUERY);
}
