import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { DataSource, SectionKey } from "../../features/data-ingestion/types.ts";
import { nextSelectedSourceId, resolveRequestedSourceId } from "./ingestionRules";

/**
 * Which source's details are open. `?sourceId=` switches to the sources section and selects that
 * source; the selection follows the list, keeping an open drawer through a transient refresh.
 */
export function useSourceSelection(
  sources: DataSource[],
  showSection: (section: SectionKey) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSourceId = searchParams.get("sourceId") ?? "";
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(() => {
      if (!isMounted) return;

      const resolved = resolveRequestedSourceId(sources, requestedSourceId);

      if (resolved) showSection("sources");
      setSelectedSourceId((current) => nextSelectedSourceId(current, sources, resolved));
    });

    return () => {
      isMounted = false;
    };
  }, [requestedSourceId, sources, showSection]);

  const selectedSource = useMemo(
    () =>
      selectedSourceId
        ? (sources.find((source) => source.sourceId === selectedSourceId) ?? null)
        : null,
    [selectedSourceId, sources],
  );

  return {
    selectedSourceId,
    selectedSource,
    select: setSelectedSourceId,
    close: () => {
      setSelectedSourceId(null);

      if (!searchParams.has("sourceId")) return;

      const next = new URLSearchParams(searchParams);
      next.delete("sourceId");
      setSearchParams(next, { replace: true });
    },
  };
}

export type SourceSelection = ReturnType<typeof useSourceSelection>;
