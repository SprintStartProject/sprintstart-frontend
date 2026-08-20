import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, Folder, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useToast } from "../../../context/useToast";
import type { ProjectSummary } from "../types";

export type ProjectAccessPanelProps = {
  assignedProjects: ProjectSummary[];
  availableProjects: ProjectSummary[];
  onOpenProjectDetails: (projectId: string) => void;
  onAssignProject: (projectId: string) => Promise<void>;
  onRemoveProject: (projectId: string) => Promise<void>;
};

type ProjectPickerState = {
  sourceKey: string;
  search: string;
  isOpen: boolean;
};

export function ProjectAccessPanel({
  assignedProjects,
  availableProjects,
  onOpenProjectDetails,
  onAssignProject,
  onRemoveProject,
}: ProjectAccessPanelProps) {
  const assignedProjectKey = useMemo(
    () =>
      assignedProjects
        .map((project) => project.id)
        .sort()
        .join("|"),
    [assignedProjects],
  );

  const assignedProjectIds = useMemo(
    () => new Set(assignedProjects.map((project) => project.id)),
    [assignedProjects],
  );

  const [projectPickerState, setProjectPickerState] = useState<ProjectPickerState>(() => ({
    sourceKey: assignedProjectKey,
    search: "",
    isOpen: false,
  }));
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const toast = useToast();

  const prefersReducedMotion = useReducedMotion();

  // Anchors the picker so it can be flipped above the button when the drawer
  // leaves no room below it.
  const pickerAnchorRef = useRef<HTMLDivElement>(null);
  const [pickerPlacement, setPickerPlacement] = useState<{
    dropUp: boolean;
    maxHeight: number;
  }>({ dropUp: false, maxHeight: 384 });

  const activeProjectPickerState =
    projectPickerState.sourceKey === assignedProjectKey
      ? projectPickerState
      : {
          sourceKey: assignedProjectKey,
          search: "",
          isOpen: false,
        };

  const projectSearch = activeProjectPickerState.search;
  const openProjectPicker = activeProjectPickerState.isOpen;
  const hasPendingProjectChange = pendingProjectId !== null;

  // On open, decide whether the picker drops down or flips up, and how tall it
  // may grow, from the room left around the button inside the drawer's viewport
  // — so it never spills below the fold and forces an extra scroll to reach it.
  useLayoutEffect(() => {
    if (!openProjectPicker) return;

    const measure = () => {
      const anchor = pickerAnchorRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const margin = 16;
      const spaceBelow = window.innerHeight - anchor.bottom - margin;
      const spaceAbove = anchor.top - margin;
      const dropUp = spaceBelow < 260 && spaceAbove > spaceBelow;

      setPickerPlacement({
        dropUp,
        maxHeight: Math.max(200, Math.min(384, dropUp ? spaceAbove : spaceBelow)),
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [openProjectPicker]);

  const projectOptions = availableProjects.filter((project) => {
    const isAlreadyAssigned = assignedProjectIds.has(project.id);
    const trimmedSearch = projectSearch.trim().toLowerCase();

    const matchesSearch =
      trimmedSearch.length === 0 ||
      project.name.toLowerCase().includes(trimmedSearch) ||
      project.id.toLowerCase().includes(trimmedSearch);

    return !isAlreadyAssigned && matchesSearch;
  });

  const updateProjectSearch = (search: string) => {
    setProjectPickerState((current) => ({
      sourceKey: assignedProjectKey,
      search,
      isOpen: current.sourceKey === assignedProjectKey ? current.isOpen : false,
    }));
  };

  const toggleProjectPicker = () => {
    if (hasPendingProjectChange) return;

    setProjectPickerState((current) => {
      const isCurrentUserState = current.sourceKey === assignedProjectKey;

      return {
        sourceKey: assignedProjectKey,
        search: isCurrentUserState ? current.search : "",
        isOpen: isCurrentUserState ? !current.isOpen : true,
      };
    });
  };

  const closeProjectPicker = () => {
    setProjectPickerState({
      sourceKey: assignedProjectKey,
      search: "",
      isOpen: false,
    });
  };

  const addProject = async (projectId: string) => {
    if (hasPendingProjectChange) return;

    setPendingProjectId(projectId);

    try {
      await onAssignProject(projectId);
      closeProjectPicker();
      toast.success("Project assigned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the project assignment.");
    } finally {
      setPendingProjectId(null);
    }
  };

  const removeProject = async (projectId: string) => {
    if (hasPendingProjectChange) return;

    setPendingProjectId(projectId);

    try {
      await onRemoveProject(projectId);
      toast.success("Project removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't remove the project assignment.",
      );
    } finally {
      setPendingProjectId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            Projects
          </p>
          <p className="mt-1 text-sm text-app-text-muted">Changes are saved immediately.</p>
        </div>

        <div className="relative" ref={pickerAnchorRef}>
          <Button
            variant="secondary"
            onClick={toggleProjectPicker}
            loading={hasPendingProjectChange}
            icon={<Plus className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Add project
          </Button>

          {openProjectPicker && (
            <motion.div
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: pickerPlacement.dropUp ? 6 : -6, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }
              }
              style={{ maxHeight: pickerPlacement.maxHeight }}
              className={`absolute right-0 z-30 flex w-[min(calc(100vw-2rem),22rem)] flex-col rounded-2xl border border-app-border bg-app-surface p-2.5 shadow-app-brand-lift ${
                pickerPlacement.dropUp
                  ? "bottom-full mb-2 origin-bottom-right"
                  : "mt-2 origin-top-right"
              }`}
            >
              <p className="mb-2 shrink-0 px-1 text-[10px] font-semibold tracking-[0.18em] text-app-text-muted uppercase">
                Add to project
              </p>

              <div className="mb-2 shrink-0">
                <Input
                  size="sm"
                  value={projectSearch}
                  onChange={(event) => updateProjectSearch(event.target.value)}
                  placeholder="Search projects..."
                  aria-label="Search projects"
                  disabled={hasPendingProjectChange}
                  icon={<Search className="h-3.5 w-3.5" />}
                />
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-auto">
                {projectOptions.length > 0 ? (
                  projectOptions.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => void addProject(project.id)}
                      disabled={hasPendingProjectChange}
                      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:border-app-brand-border-strong hover:bg-app-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-app-text-muted transition-colors group-hover:bg-app-surface group-hover:text-app-brand">
                        <Folder className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-app-text">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-app-text-muted">
                          {project.id}
                        </span>
                      </span>

                      {pendingProjectId === project.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-text-muted" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-app-brand opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                    <Folder className="h-5 w-5 text-app-text-disabled" />
                    <p className="text-sm text-app-text-muted">No unassigned projects available.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {assignedProjects.length > 0 ? (
          assignedProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-app-border bg-app-surface-muted px-3 py-4 transition-all hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-app-brand-lift motion-reduce:hover:translate-y-0 sm:px-4"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-surface text-app-text-muted">
                    <Folder className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-app-text">{project.name}</p>
                    <p
                      className="mt-0.5 truncate font-mono text-xs text-app-text-muted"
                      title={project.id}
                    >
                      {project.id}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => onOpenProjectDetails(project.id)}
                    disabled={hasPendingProjectChange}
                    className="hover:bg-app-brand-soft hover:text-app-brand-text"
                    aria-label={`Open ${project.name} project details`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    onClick={() => void removeProject(project.id)}
                    disabled={hasPendingProjectChange}
                    loading={pendingProjectId === project.id}
                    className="hover:bg-app-danger-bg hover:text-app-danger-text"
                    aria-label={`Remove ${project.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-8 text-center lg:col-span-2">
            <p className="text-sm font-medium text-app-text">No projects assigned</p>
            <p className="mt-1 text-sm text-app-text-muted">
              Add a project to assign this user to a project.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
