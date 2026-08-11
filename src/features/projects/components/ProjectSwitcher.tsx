import { useEffect, useState } from "react";
import { ChevronsUpDown, FolderKanban } from "lucide-react";
import { useProjectContext } from "../useProjectContext";
import { ProjectSwitcherModal } from "./ProjectSwitcherModal";

type ProjectSwitcherProps = {
  className?: string;
};

/**
 * Global project switcher shown in the sidebar footer.
 *
 * Renders nothing for permission groups that do not get a switcher, so the
 * sidebar layout is unaffected for those users. Opens a modal picker on click
 * or with Cmd/Ctrl+K; focus trapping and restoration are handled by `Modal`.
 */
export function ProjectSwitcher({ className = "" }: ProjectSwitcherProps) {
  const {
    projects,
    selectedProject,
    selectedProjectId,
    isLoading,
    errorMessage,
    isSwitcherEnabled,
    setSelectedProjectId,
  } = useProjectContext();

  const [isOpen, setIsOpen] = useState(false);

  // Cmd/Ctrl+K opens the switcher from anywhere.
  useEffect(() => {
    if (!isSwitcherEnabled) return;

    const handleShortcut = (event: KeyboardEvent) => {
      // Synthetic "keydown" events (e.g. from browser extensions dispatching a
      // bare `new Event("keydown")` on window) have an undefined `key`. Bail
      // before calling a method on it — real KeyboardEvents always have a
      // string `key`, so this never affects the Cmd/Ctrl+K shortcut.
      if (typeof event.key !== "string") return;
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isSwitcherEnabled]);

  if (!isSwitcherEnabled) {
    return null;
  }

  const handleSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsOpen(false);
  };

  const triggerLabel = selectedProject?.name ?? "Select a project";
  const triggerHint = !selectedProject
    ? "No project selected"
    : selectedProject.isManaged
      ? "Managed by you"
      : "Member";

  return (
    <div className={className}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Switch project. Current project: ${triggerLabel}`}
        onClick={() => setIsOpen(true)}
        className="group flex h-[52px] w-full items-center gap-[10px] rounded-xl border border-app-border bg-app-surface px-[10px] text-left transition-all hover:border-app-border-strong hover:bg-app-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft transition-colors group-hover:bg-app-brand group-hover:text-white">
          <FolderKanban className="h-[18px] w-[18px] text-app-brand transition-colors group-hover:text-white" />
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-app-text">
            {triggerLabel}
          </span>

          <span className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-app-text-muted">
            {triggerHint}
          </span>
        </span>

        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-app-text-muted transition-colors group-hover:text-app-text" />
      </button>

      <ProjectSwitcherModal
        isOpen={isOpen}
        projects={projects}
        selectedProjectId={selectedProjectId}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onSelect={handleSelect}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
