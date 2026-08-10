import { useEffect, useState } from "react";
import { connectorService } from "../../../services/connectorService";
import type { SourceSystem } from "../types";

/**
 * Uploads are not a connector: there is nothing to configure or enable, and the backend
 * skips them when validating a source filter. They are therefore always offerable.
 */
const ALWAYS_AVAILABLE: readonly SourceSystem[] = ["UPLOAD"];

/**
 * Maps a backend connector id onto the source system the chat filters by. Connector ids are
 * lowercase (`github`, `jira`); the filter values are the uppercase enum constants.
 */
function toSourceSystem(connectorId: string): SourceSystem | null {
    const candidate = connectorId.toUpperCase();
    return candidate === "GITHUB" || candidate === "JIRA" || candidate === "UPLOAD"
        ? candidate
        : null;
}

/**
 * The source systems that can actually be filtered on right now.
 *
 * The composer used to offer a hardcoded list, so a connector that was never configured — or
 * had been disabled — was still selectable and the prompt then failed. Offering only what
 * exists keeps the filter honest, and an empty result is a meaningful answer: nothing is
 * connected yet.
 *
 * A failed lookup degrades to the always-available set rather than an error: the filter is an
 * optional refinement, and blocking the composer over it would be worse than offering less.
 */
export function useAvailableSources(): { sources: SourceSystem[]; loading: boolean } {
    const [sources, setSources] = useState<SourceSystem[]>([...ALWAYS_AVAILABLE]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const connectors = await connectorService.listConnectors();
                if (cancelled) return;

                const enabled = connectors
                    .filter(connector => connector.enabled)
                    .map(connector => toSourceSystem(connector.id))
                    .filter((system): system is SourceSystem => system !== null);

                setSources([...new Set([...enabled, ...ALWAYS_AVAILABLE])]);
            } catch (e) {
                console.error("Failed to load connectors for the chat source filter", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return { sources, loading };
}
