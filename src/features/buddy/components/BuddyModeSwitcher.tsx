import { useMemo } from "react";
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
 * **The switcher drives the global selection, not a private copy of it.** Team mode is bound to
 * the globally selected project (see `useBuddyConversation`), so picking a project here both
 * switches the app's selection and points the buddy at it — the two contexts cannot disagree,
 * which is the whole point of the binding. When the selection moves from somewhere else while
 * the buddy is mid-team-conversation, the session falls back to the hire thread and says why
 * (a toast, from `BuddyProvider`); this component only ever *offers* the switch, never audits
 * it — the session owns that, so it holds even when no surface is mounted.
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
  /** Switches the conversation; `null` returns to the hire's own conversation. */
  onSwitch: (projectId: string | null) => void;
  /** Off while a turn is in flight — a stream cannot call back into a cleared thread. */
  disabled?: boolean;
  className?: string;
}) {
  const { projects } = useProjectContext();

  const managedProjects = useMemo(
    () => projects.filter((project) => project.isManaged),
    [projects],
  );

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
