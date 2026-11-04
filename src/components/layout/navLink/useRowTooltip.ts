import { useState, type RefObject } from "react";

type RowTooltip = {
  at: { x: number; y: number } | null;
  show: () => void;
  hide: () => void;
};

/**
 * Where the collapsed entry's tooltip sits, measured when it is asked for (pointer over the entry,
 * or keyboard focus on it) — `null` while hidden. Drawn in a portal at a fixed position: the nav
 * clips anything that reaches past its edge, which is exactly where a tooltip goes.
 */
export function useRowTooltip(
  elementRef: RefObject<HTMLDivElement | null>,
  collapsed: boolean,
): RowTooltip {
  const [at, setAt] = useState<RowTooltip["at"]>(null);

  const show = () => {
    const rect = elementRef.current?.getBoundingClientRect();
    if (collapsed && rect) setAt({ x: rect.right + 10, y: rect.top + rect.height / 2 });
  };

  return { at, show, hide: () => setAt(null) };
}
