import { useEffect, useMemo, useRef } from "react";
import { useProjectContext } from "../../projects/useProjectContext";
import { Select } from "../../../components/ui/Select";

/**
 * Hire conversation ↔ team conversations, as one native select.
 *
 * The options are the projects this user *manages* — not the ones they can merely switch to.
 * `isManaged` comes from the global project context and mirrors the backend's project manager
 * assignment, which is exactly who the team-mode conversation is for: the backend resolves the
 * caller's management server-side, so a project a manager merely belongs to would fail on the
 * first team message. Not listed means not offerable.
 *
 * **The restore audit lives here.** The stored team project id is restored raw (so a manager
 * who reloads keeps their conversation — see `useBuddyConversation`), but whether it still
 * belongs to this manager is a question only the loaded project list can answer. Once that list
 * has arrived, a stored id that no managed project vouches for is dropped back to the hire
 * conversation — *loudly*, because a silent fallback would be the exact drift the persisted
 * selection audit warns about: a conversation claiming to be about a project it cannot touch.
 *
 * Renders nothing for a user who manages nothing: the switcher is not an affordance a hire
 * should even see, and an empty select would suggest one.
 */
export function BuddyModeSwitcher({
  teamProjectId,
  onSwitch,
  disabled = false,
  className = "",
}: {
  /** The conversation's current team project, or `null` for the hire's own conversation. */
  teamProjectId: string | null;
  /** Switches the conversation; `null` returns to the hire's own. */
  onSwitch: (projectId: string | null) => void;
  /** Off while a turn is in flight — a stream cannot call back into a cleared thread. */
  disabled?: boolean;
  className?: string;
}) {
  const { projects, isLoading } = useProjectContext();

  const managedProjects = useMemo(
    () => projects.filter((project) => project.isManaged),
    [projects],
  );
  const managesStoredProject = useMemo(
    () => managedProjects.some((project) => project.id === teamProjectId),
    [managedProjects, teamProjectId],
  );

  // The audit drops a stored conversation this user no longer runs — but only when a switch
  // would actually be accepted. Read through a ref so the effect does not re-arm on every
  // parent render (the callback is usually an inline arrow), and wait out `disabled` (a turn
  // in flight refuses switches): when the turn ends, the changed `disabled` re-runs the audit
  // and the fallback still happens — just at a moment it can succeed.
  const onSwitchRef = useRef(onSwitch);
  useEffect(() => {
    onSwitchRef.current = onSwitch;
  });

  useEffect(() => {
    if (isLoading || disabled || teamProjectId === null || managesStoredProject) return;

    console.warn(
      `Buddy team mode dropped a stored project (${teamProjectId}) that this user no longer manages.`,
    );
    onSwitchRef.current(null);
  }, [isLoading, disabled, teamProjectId, managesStoredProject]);

  if (managedProjects.length === 0) return null;

  return (
    <Select
      data-testid="buddy-mode-switcher"
      className={className}
      aria-label="Which conversation is your buddy in"
      value={teamProjectId ?? ""}
      disabled={disabled}
      size="sm"
      onChange={(event) => {
        const value = event.target.value;
        onSwitch(value === "" ? null : value);
      }}
    >
      <option value="">Your onboarding</option>
      {managedProjects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  );
}
