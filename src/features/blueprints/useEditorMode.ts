import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useLocation } from "react-router-dom";
import { blueprintService } from "../../services/blueprintService.ts";
import type { BlueprintReopen, EditorMode } from "./pathEditorTypes.ts";
import type { PathPageContext } from "./pathPageContext.ts";
import type { SubGraphState } from "./useSubGraph.ts";
import { withGraphNodes } from "./withGraphNodes.ts";

type SetMode = Dispatch<SetStateAction<EditorMode>>;

/** Getting into the graph view, back out of a phase's graph, and keeping the open view current. */
function useGraphNavigation(
  context: PathPageContext,
  sub: SubGraphState,
  mode: EditorMode,
  setMode: SetMode,
) {
  const { path, scope } = context;

  /** Reloads top-level graph positions, which are not refreshed by subgraph mutations. */
  async function reloadTopLevelGraph() {
    if (!path) return;
    const graph = await blueprintService.getGraph(scope, path.id);
    context.setPath((current) => (current ? withGraphNodes(current, graph.nodes) : current));
  }

  async function returnToTopLevelGraph() {
    if (!path) return;
    context.setPageError(null);
    sub.clear();
    try {
      await reloadTopLevelGraph();
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "Blueprint graph could not be loaded.",
      );
    }
  }

  async function openGraphEditor() {
    if (!path) return;
    context.setPageError(null);
    try {
      const open = sub.phaseId
        ? path.blueprintPhases.find((phase) => phase.id === sub.phaseId)
        : null;
      if (open?.type === "FIXED") {
        const graph = await blueprintService.getSubGraph(scope, open.id);
        sub.setNodes(graph.nodes);
      } else {
        await reloadTopLevelGraph();
        if (sub.phaseId) sub.clear();
      }
      setMode("graph");
    } catch (reason) {
      context.setPageError(
        reason instanceof Error ? reason.message : "Blueprint graph could not be loaded.",
      );
    }
  }

  /** Switching views, from the bar or from a two-finger swipe — the two must not disagree. */
  function changeEditorMode(next: EditorMode) {
    if (next === mode) return;
    if (next === "graph") {
      void openGraphEditor();
      return;
    }
    setMode("list");
    // The graph endpoints update node revisions independently from the nested path DTO. Reload it
    // before exposing list mutations so their optimistic-lock revisions are current.
    void context.loadPath();
  }

  return { openGraphEditor, returnToTopLevelGraph, changeEditorMode };
}

interface ReopenTargets {
  sub: SubGraphState;
  setMode: SetMode;
  setOpenPhaseTitle: (title: string | null) => void;
  setOpenNodeTitle: (title: string | null) => void;
  openGraphEditor: () => Promise<void>;
}

/**
 * Puts the author back in front of what they were looking at before they were sent here.
 *
 * **Not until the path on screen is the one the address names.** Navigating to the draft changes
 * the URL immediately; the draft itself arrives a request later, and until it does `path` is
 * still the *published* version this request came from. Its phases carry the same titles — a
 * draft is a copy — so a title match against it succeeds and reopens a phase whose id exists only
 * in the version that was just left, and the page it opened would vanish the moment the draft
 * lands.
 *
 * The state is cleared as soon as it is acted on: a reload or a step back through history must
 * not open the same thing again, and a title that matches nothing is not a reason to
 * keep asking.
 */
function useReopenRequest(context: PathPageContext, targets: ReopenTargets) {
  const { path, pathId, navigate } = context;
  const location = useLocation();
  const reopenRequest = (location.state as { reopen?: BlueprintReopen } | null)?.reopen ?? null;

  useEffect(() => {
    if (!reopenRequest || !path || path.id !== pathId) return;
    const phase = path.blueprintPhases.find(
      (candidate) => candidate.title === reopenRequest.phaseTitle,
    );
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    if (!phase) return;
    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body,
    // and this is the pattern the repo already passes with.
    queueMicrotask(() => {
      if (reopenRequest.nodeTitle && phase.type === "FIXED") {
        targets.setOpenNodeTitle(reopenRequest.nodeTitle);
        targets.setMode("graph");
        void targets.sub.open(phase);
        return;
      }
      targets.setOpenPhaseTitle(phase.title);
      void targets.openGraphEditor();
    });
    // The targets are rebuilt every render and would restart this on every one; what this effect
    // actually depends on is the request and the path it has to find it in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, navigate, path, pathId, reopenRequest]);
}

/** Which of the two views is showing, what the graph should open by itself, and how to move. */
export function useEditorMode(context: PathPageContext, sub: SubGraphState) {
  const [mode, setMode] = useState<EditorMode>("list");
  const [openPhaseTitle, setOpenPhaseTitle] = useState<string | null>(null);
  const [openNodeTitle, setOpenNodeTitle] = useState<string | null>(null);
  const navigation = useGraphNavigation(context, sub, mode, setMode);
  useReopenRequest(context, {
    sub,
    setMode,
    setOpenPhaseTitle,
    setOpenNodeTitle,
    openGraphEditor: navigation.openGraphEditor,
  });

  /** Keeps an open fixed-phase graph current after mutations from its detail panel. */
  async function refreshActiveEditorData() {
    if (mode === "graph" && sub.phaseId) {
      await sub.refresh(sub.phaseId);
      return;
    }
    await context.loadPath();
  }

  return {
    mode,
    openPhaseTitle,
    openNodeTitle,
    setOpenPhaseTitle,
    setOpenNodeTitle,
    refreshActiveEditorData,
    ...navigation,
  };
}
