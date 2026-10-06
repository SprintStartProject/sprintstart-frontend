import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { isPmWorkspacePath } from "../../features/pm-area/pmWorkspacePaths";
import { pageTransitionToken } from "../../styles/tokens";

/**
 * Routes that share one mounted page transition as a group. Every `/buddy` address is the same
 * page — a conversation is a parameter, not a different screen — so they share one key and
 * switching conversations never remounts the page and its open session under it.
 *
 * The PM workspace is the same arrangement: one layout route for all of its sections, which
 * slide between each other on their own.
 */
function transitionKey(pathname: string): string {
  if (pathname.startsWith("/buddy")) return "buddy";
  if (isPmWorkspacePath(pathname)) return "pm-workspace";

  return pathname;
}

/**
 * A light enter transition for route changes, wrapped around `<Routes>` in `AppRouter`.
 *
 * Deliberately enter-only — no `AnimatePresence mode="wait"`. That mode holds the incoming
 * page back until the outgoing one has finished leaving, which is real latency a route
 * change does not need to pay: the previous page's DOM is simply replaced the moment the
 * new one is ready, and only the new one fades and lifts in.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={transitionKey(location.pathname)}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={pageTransitionToken}
    >
      {children}
    </motion.div>
  );
}
