import { useState } from "react";
import type { CollapsedIds } from "./components/outline/outlineActions.ts";

/** Which cards of one kind the author has folded away. */
export function useCollapsedIds(): CollapsedIds {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  return {
    has: (id) => ids.has(id),
    toggle: (id) =>
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}
