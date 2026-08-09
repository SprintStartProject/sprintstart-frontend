import { useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Folder,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
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

  const [projectPickerState, setProjectPickerState] =
    useState<ProjectPickerState>(() => ({
      sourceKey: assignedProjectKey,
      search: "",
      isOpen: false,
    }));
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
    setErrorMessage("");

    try {
      await onAssignProject(projectId);
      closeProjectPicker();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Project assignment could not be saved.",
      );
    } finally {
      setPendingProjectId(null);
    }
  };

  const removeProject = async (projectId: string) => {
    if (hasPendingProjectChange) return;

    setPendingProjectId(projectId);
    setErrorMessage("");

    try {
      await onRemoveProject(projectId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Project assignment could not be removed.",
      );
    } finally {
      setPendingProjectId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface-muted p-3 sm:rounded-3xl sm:p-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="items-center align-middle">
          <p className="text-xl font-semibold text-app-text sm:text-2xl">
            Projects
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Changes are saved immediately.
          </p>
        </div>

        <div className="relative">
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
            <div className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-app-border bg-app-surface p-2 shadow-xl">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-text-disabled" />
                <input
                  value={projectSearch}
                  onChange={(event) => updateProjectSearch(event.target.value)}
                  placeholder="Search projects..."
                  disabled={hasPendingProjectChange}
                  className="h-9 w-full rounded-xl border border-app-border bg-app-surface-muted pl-9 pr-3 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div className="max-h-64 space-y-1 overflow-auto">
                {projectOptions.length > 0 ? (
                  projectOptions.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => void addProject(project.id)}
                      disabled={hasPendingProjectChange}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-app-text">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-app-text-muted">
                          {project.id}
                        </span>
                      </span>
                      {pendingProjectId === project.id && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-app-text-muted" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-app-text-muted">
                    No unassigned projects available.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {assignedProjects.length > 0 ? (
          assignedProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-app-border bg-app-surface px-3 py-4 sm:px-4"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-surface-muted text-app-text-muted">
                    <Folder className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-app-text">
                      {project.name}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-app-text-muted">
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
          <div className="rounded-2xl border border-dashed border-app-border bg-app-surface px-4 py-8 text-center lg:col-span-2">
            <p className="text-sm font-medium text-app-text">
              No projects assigned
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              Add a project to assign this user to a project.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
