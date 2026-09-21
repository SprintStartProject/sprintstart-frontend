import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronsUpDown, FolderKanban, ShieldCheck } from "lucide-react";
import { useProjectContext } from "../useProjectContext";
import { ProjectSwitcherModal } from "./ProjectSwitcherModal";
import { Badge } from "../../../components/ui/Badge";
import { ShortcutHint } from "../../../components/ui/ShortcutHint";
import { monogramLetters, monogramTint } from "../projectMonogram";
import { hoverSpringToken } from "../../../styles/tokens";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const SWITCHER_CHORD = IS_MAC ? "⌘ + K" : "Ctrl + K";

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

  return (
    <div className={className}>
      <motion.button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Switch project. Current project: ${triggerLabel}`}
        title={`Switch project (${SWITCHER_CHORD})`}
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={hoverSpringToken}
        className="group flex h-[52px] w-full items-center gap-[10px] rounded-[14px] border border-app-border/70 bg-app-bg/60 px-[10px] text-left backdrop-blur-md transition-colors hover:border-app-brand-border hover:bg-app-surface-hover/70 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        {selectedProject ? (
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold ${monogramTint(selectedProject.id)}`}
          >
            {monogramLetters(selectedProject.name)}
          </span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-app-surface-muted">
            <FolderKanban className="h-[18px] w-[18px] text-app-text-muted" />
          </span>
        )}

        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-sm leading-tight font-semibold text-app-text">
            {triggerLabel}
          </span>

          {/* The same two badges the project details drawer uses for a person's
              role, so "manager" looks the same wherever it is stated. */}
          {!selectedProject ? (
            <span className="truncate text-xs text-app-text-muted">No project selected</span>
          ) : selectedProject.isManaged ? (
            <Badge variant="brand" size="sm" className="w-fit">
              <ShieldCheck aria-hidden="true" className="mr-1 h-3 w-3" />
              Manager
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm" className="w-fit">
              Member
            </Badge>
          )}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-1">
          <ShortcutHint keys={SWITCHER_CHORD} className="border-app-border text-app-text-muted" />
          <ChevronsUpDown className="h-4 w-4 text-app-text-muted transition-colors group-hover:text-app-text" />
        </span>
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
