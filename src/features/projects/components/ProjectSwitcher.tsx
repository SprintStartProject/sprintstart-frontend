import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronsUpDown, FolderKanban } from "lucide-react";
import { useProjectContext } from "../useProjectContext";
import { ProjectSwitcherModal } from "./ProjectSwitcherModal";
import { hoverSpringToken } from "../../../styles/tokens";

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
      <motion.button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Switch project. Current project: ${triggerLabel}`}
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={hoverSpringToken}
        className="group flex h-[52px] w-full items-center gap-[10px] rounded-[14px] border border-app-border/70 bg-app-bg/60 px-[10px] text-left backdrop-blur-md transition-colors hover:border-app-brand-border hover:bg-app-surface-hover/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-app-brand-soft transition-colors group-hover:bg-app-brand group-hover:text-white">
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
      </motion.button>

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
