import { useEffect, useState } from "react";
import { knowledgeService } from "../../../services/knowledgeService";
import { toSourceSystem } from "../../data-ingestion/connectors/sourceSystems";
import { CHAT_SOURCE_SYSTEMS } from "../../data-ingestion/connectors/registry";
import type { SourceSystem } from "../../data-ingestion/connectors/sourceSystems";

/**
 * Uploads are not a connector: there is nothing to configure or enable, and the backend
 * skips them when validating a source filter. They are therefore always offerable.
 */
const ALWAYS_AVAILABLE: readonly SourceSystem[] = ["UPLOAD"];

/**
 * Maps a source system name from the project's artifact facets onto the source system the buddy
 * filters by. Facet values are the uppercase enum constants, the same as the filter values.
 */
function toFilterSystem(facetValue: string): SourceSystem | null {
  const system = toSourceSystem(facetValue);
  return system && CHAT_SOURCE_SYSTEMS.includes(system) ? system : null;
}

/**
 * The source systems that can actually be filtered on right now: the ones the project has
 * indexed artifacts from, plus uploads.
 *
 * Read from the project's artifact facets rather than the connector list. That list is
 * restricted to admins and PMs, so a regular user got a 403 and was left with uploads only,
 * even though the project had a repository connected. The facets are open to every project
 * member, and a source with nothing indexed yet would not match anything as a filter anyway.
 *
 * A failed lookup, or no project yet, degrades to the always-available set rather than an
 * error: the filter is an optional refinement, and blocking the composer over it would be worse
 * than offering less.
 */
export function useAvailableSources(projectId: string | null): {
  sources: SourceSystem[];
  loading: boolean;
} {
  // Remembers which project the answer is for, so a project switch reads as loading instead of
  // offering the previous project's sources until the new lookup returns.
  const [result, setResult] = useState<{ projectId: string; sources: SourceSystem[] } | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    void (async () => {
      let sources: SourceSystem[] = [...ALWAYS_AVAILABLE];

      try {
        const facets = await knowledgeService.getArtifactFacets(projectId);

        const indexed = (facets.sources ?? [])
          .filter((facet) => facet.count > 0)
          .map((facet) => toFilterSystem(facet.value))
          .filter((system): system is SourceSystem => system !== null);

        sources = [...new Set([...indexed, ...ALWAYS_AVAILABLE])];
      } catch (e) {
        console.error("Failed to load the project's sources for the buddy source filter", e);
      }

      if (!cancelled) setResult({ projectId, sources });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Without a project there is nothing to look up.
  if (!projectId) return { sources: [...ALWAYS_AVAILABLE], loading: false };

  if (result?.projectId !== projectId) return { sources: [...ALWAYS_AVAILABLE], loading: true };

  return { sources: result.sources, loading: false };
}
