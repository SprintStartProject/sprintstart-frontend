import { useCallback, useEffect, useRef, useState } from "react";
import { readStoredTeamMode, writeStoredTeamMode } from "../conversation/buddyPreferences";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";

/**
 * Whether the manager has pointed the buddy at a project instead of their own onboarding, and the
 * project that binding was made to.
 *
 * Persisted per signed-in user; the *project* it means is never stored independently — it is
 * whichever project the global context currently vouches for, so team mode and the rest of the app
 * can never disagree about which project is being discussed.
 */
function useTeamPreference(userId: string | null) {
  const [isTeamMode, setIsTeamMode] = useState(false);
  const userIdRef = useRef<string | null>(null);
  // Declared before the effect that resets it: the target binding must not outlive the user whose
  // thread created it.
  const targetRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = userId;
    // A user change drops the old user's project binding, not just the visible mode, so the adopt
    // effect cannot compare the next user's selection against it.
    targetRef.current = null;
    // Re-read on every subject change, so a logout or account switch inherits nothing. Deferred to
    // a microtask so setState never runs synchronously in the effect body.
    void (async () => {
      await Promise.resolve();
      setIsTeamMode(userId === null ? false : readStoredTeamMode(userId));
    })();
  }, [userId]);

  const setTeamMode = useCallback((value: boolean) => {
    setIsTeamMode(value);
    const id = userIdRef.current;

    if (id !== null) writeStoredTeamMode(id, value);
    if (!value) targetRef.current = null;
  }, []);

  /** The project the binding was made to, as it is right now. */
  const targetNow = useCallback(() => targetRef.current, []);
  const bindTarget = useCallback((projectId: string) => {
    targetRef.current = projectId;
  }, []);

  return { isTeamMode, setTeamMode, targetNow, bindTarget };
}

type Preference = ReturnType<typeof useTeamPreference>;

/**
 * Team mode ends involuntarily when the ground moves under it: the selected project stops being
 * manageable, or the manager moved the global selection somewhere else while the buddy was
 * discussing the old one. The conversation then falls back to the hire thread — audibly, via
 * `onTeamModeLeft`, because a silent fallback is exactly the drift this binding exists to prevent.
 * Voluntary switches never pass through here: they bind the new target before the state settles,
 * so this effect sees a matching pair and stays out of the way.
 */
function useTeamModeGuard(
  selection: ProjectSelectionSlice,
  { isTeamMode, setTeamMode, targetNow, bindTarget }: Preference,
  onTeamModeLeft: (() => void) | undefined,
) {
  useEffect(() => {
    if (!isTeamMode || selection.isLoading) return;

    void (async () => {
      await Promise.resolve();
      const target = targetNow();
      const manageable = selection.hasSelectedProject && selection.canManageSelected;

      // A restored preference adopting whatever the loaded list vouches for. Nothing to bind to —
      // no selection, or none of it manageable — and team mode ends audibly.
      if (target === null && manageable) {
        bindTarget(selection.selectedProjectId);
        return;
      }

      if (
        target === null ||
        !selection.canManageSelected ||
        selection.selectedProjectId !== target
      ) {
        setTeamMode(false);
        onTeamModeLeft?.();
      }
    })();
  }, [
    isTeamMode,
    selection.isLoading,
    selection.hasSelectedProject,
    selection.canManageSelected,
    selection.selectedProjectId,
    setTeamMode,
    targetNow,
    bindTarget,
    onTeamModeLeft,
  ]);
}

export function useTeamMode(
  selection: ProjectSelectionSlice,
  userId: string | null,
  onTeamModeLeft: (() => void) | undefined,
) {
  const preference = useTeamPreference(userId);
  const { isTeamMode } = preference;

  /**
   * The managed project this conversation is about, or `null` for the hire's own. Derived,
   * never stored: it exists only while the team preference is on *and* the loaded project list
   * vouches that this user manages the selected project. That derivation is the scoping
   * guarantee — before the list arrives, or once management is gone, the value collapses to the
   * hire conversation, so no team-scoped request can go to a project the buddy has no business
   * touching. Held as a ref alongside the value so the streaming calls read the current
   * conversation mid-turn without every token re-creating their callbacks.
   */
  const teamProjectId =
    isTeamMode && selection.hasSelectedProject && selection.canManageSelected
      ? selection.selectedProjectId
      : null;
  const teamProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    teamProjectIdRef.current = teamProjectId;
  }, [teamProjectId]);

  useTeamModeGuard(selection, preference, onTeamModeLeft);

  return {
    isTeamMode,
    teamProjectId,
    setTeamMode: preference.setTeamMode,
    teamProjectNow: useCallback(() => teamProjectIdRef.current, []),
    // Makes the thread on screen follow the derived project at once, ahead of the effect.
    adoptTeamProject: useCallback((projectId: string | null) => {
      teamProjectIdRef.current = projectId;
    }, []),
    // Binds a voluntary switch to its project before the state settles.
    bindTeamTarget: preference.bindTarget,
  };
}
