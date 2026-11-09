import { useCallback, useEffect, useReducer, useRef, type Dispatch } from "react";
import { knowledgeService } from "../../../services/knowledgeService";
import { drawerReducer, initialState, type DrawerAction, type DrawerState } from "../drawerState";
import { runSummary } from "../summaryStream";
import type { Artifact } from "../types";

interface ArtifactDrawerData {
  state: DrawerState;
  dispatch: Dispatch<DrawerAction>;
  /** Starts (or restarts) the AI summary of the open artifact. */
  summarize: () => Promise<void>;
}

/**
 * The drawer's data: its reducer state, the artifact content loaded into it whenever a
 * new artifact is selected, and the summary stream that can run against it.
 *
 * `skipContentLoad` is for artifacts shown purely from their metadata: they carry no
 * stored bytes (for a GitHub organization the content endpoint answers a 302 redirect to
 * the org's GitHub page, and following it would land the drawer on GitHub's HTML), so the
 * fetch is skipped entirely.
 */
export function useArtifactDrawerData(
  artifact: Artifact | null,
  projectId: string,
  skipContentLoad: boolean,
): ArtifactDrawerData {
  const [state, dispatch] = useReducer(drawerReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped each time the user switches artifact or unmounts. Long-running
  // summarize loops read this to bail out before dispatching into a stale reducer.
  const generationRef = useRef(0);

  useEffect(() => {
    if (!artifact) return;

    // Invalidate any in-flight summarize loop: when the artifact changes, the
    // previous loop's pending retry delay must not start a new stream for the
    // old artifact, and must not abort the new artifact's controller.
    generationRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;

    let isMounted = true;
    // `reset` also closes any open delete-confirm modal so a stale
    // confirmation for the previous artifact can't be carried over.
    dispatch({ type: "reset" });

    if (skipContentLoad) {
      dispatch({ type: "skipContentLoad" });
    } else {
      knowledgeService
        .getArtifactContent(projectId, artifact.id, artifact.sourceSystem)
        .then((data) => {
          if (isMounted) dispatch({ type: "loadSuccess", content: data });
        })
        .catch((err) => {
          if (isMounted) {
            dispatch({
              type: "loadError",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
    }

    const myGeneration = generationRef.current;
    return () => {
      isMounted = false;
      // Bump unconditionally: unmount or artifact switch invalidates any in-flight
      // summarize loop captured against `myGeneration`. Idempotent if already bumped.
      generationRef.current = myGeneration + 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [artifact, projectId, skipContentLoad]);

  useEffect(() => {
    const currentContent = state.content;
    return () => {
      if (currentContent?.isObjectUrl) {
        URL.revokeObjectURL(currentContent.content);
      }
    };
  }, [state.content]);

  const summarize = useCallback(async () => {
    if (!artifact) return;
    await runSummary({ projectId, artifactId: artifact.id, dispatch, abortRef, generationRef });
  }, [artifact, projectId]);

  return { state, dispatch, summarize };
}
