import { useReducedMotion } from "framer-motion";
import { useMemo } from "react";

/** How the create form and the open role's panel grow and shrink; none for reduced motion. */
export function useExpandTransition() {
  const prefersReducedMotion = useReducedMotion();

  const transition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const },
    [prefersReducedMotion],
  );

  return { transition, prefersReducedMotion };
}
