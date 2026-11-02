import { useCallback, useEffect, useRef, useState } from "react";
import type { BuddySessionFilters } from "../types";
import { useMentorTools } from "./useMentorTools";

/**
 * The composer's "what goes into this message" controls: which source systems and indexed-date
 * window retrieval may use, and whether the mentor may act.
 *
 * Session-level rather than per-composer state (the dock and the page share one set): the hire sets
 * them the way they set a lens, not per question. `toWireFilters` maps the camelCase shape onto the
 * wire vocabulary when a message goes out; the mentor switch is persisted per user, default on.
 */
export function useComposerOptions(userId: string | null) {
  const [filters, setFilters] = useState<BuddySessionFilters>({
    sourceSystems: [],
    from: "",
    to: "",
  });
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  const filtersNow = useCallback(() => filtersRef.current, []);

  const { capabilitiesEnabled, setCapabilitiesEnabled, capabilitiesNow } = useMentorTools(userId);

  return {
    filters,
    setFilters,
    filtersNow,
    capabilitiesEnabled,
    setCapabilitiesEnabled,
    capabilitiesNow,
  };
}

export type ComposerOptions = ReturnType<typeof useComposerOptions>;
