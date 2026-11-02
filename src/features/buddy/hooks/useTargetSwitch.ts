import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { OpeningLatches } from "../conversation/openingLatches";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";
import type { useTeamMode } from "./useTeamMode";

type Team = ReturnType<typeof useTeamMode>;

type Parts = Pick<Team, "teamProjectId" | "adoptTeamProject" | "setTeamMode" | "bindTeamTarget"> & {
  /**
   * Whether anything is in flight that the thread cannot be cleared under: a turn, an opening
   * read, a greeting, a proposal decision. Render-time state; `decidingNow` is read beside it,
   * because a decision and a move can land in one frame, before the "deciding" state re-rendered.
   */
  busy: boolean;
  decidingNow: () => boolean;
  selection: ProjectSelectionSlice;
  latches: OpeningLatches;
  clearThread: () => void;
  setIsThinking: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  ensureOpened: () => Promise<void>;
};

/**
 * Keeps the thread on screen in step with the conversation the app is aimed at.
 *
 * The thread always belongs to exactly one conversation. When the derived target moves — a switch,
 * a restored preference arriving, an involuntary exit — the thread is cleared and the new
 * conversation opens exactly as an untouched visit would: read first, then greeted. The backend
 * keeps the conversations separate, so reusing the load latch would show one inside the other.
 * Mid-turn the move waits: `busy` is in the dependency list, so the effect re-runs the moment the
 * turn ends and applies then.
 */
function useFollowTarget(parts: Parts) {
  const { teamProjectId, adoptTeamProject, busy, decidingNow, latches } = parts;
  const { clearThread, setIsThinking, setIsStreaming, ensureOpened } = parts;
  const openedForRef = useRef<string>("hire");

  useEffect(() => {
    const target = teamProjectId ?? "hire";
    if (openedForRef.current === target || busy || decidingNow()) return;

    openedForRef.current = target;
    adoptTeamProject(teamProjectId);

    // Deferred to a microtask so setState never runs synchronously in the effect body; the latch
    // and the target above are already set, so nothing can start the same switch twice.
    void (async () => {
      await Promise.resolve();
      clearThread();
      setIsThinking(false);
      setIsStreaming(false);
      // Releasing the latch is what lets `ensureOpened` read and greet the conversation being
      // switched to, exactly as it did the first time.
      latches.releaseLoad();
      void ensureOpened();
    })();
  }, [
    teamProjectId,
    busy,
    decidingNow,
    adoptTeamProject,
    clearThread,
    setIsThinking,
    setIsStreaming,
    latches,
    ensureOpened,
  ]);
}

/**
 * The buddy's own way to aim itself at a managed project, and the effect that follows the aim.
 *
 * `switchTeamProject(null)` returns to the hire's own onboarding. The conversation itself is
 * switched by the effect; the function only sets the preference and, for a project target, the
 * global selection — team mode and the rest of the app then agree on the project by construction.
 * Refused while anything is in flight: a stream cannot call its callbacks into a thread that has
 * just been cleared.
 */
export function useTargetSwitch(parts: Parts) {
  useFollowTarget(parts);
  const { busy, decidingNow, selection, setTeamMode, bindTeamTarget } = parts;

  const switchTeamProject = useCallback(
    (projectId: string | null) => {
      if (busy || decidingNow()) return;

      if (projectId === null) {
        setTeamMode(false);
        return;
      }

      selection.setSelectedProjectId(projectId);
      // Bind the conversation target before the derived value settles, so the adopt/exit effect
      // sees a matching pair and does not read the buddy's own switch as an exit.
      bindTeamTarget(projectId);
      setTeamMode(true);
    },
    [busy, decidingNow, selection, setTeamMode, bindTeamTarget],
  );

  return { switchTeamProject };
}
