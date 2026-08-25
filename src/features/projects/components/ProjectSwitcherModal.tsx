import { useMemo, useRef, useState } from "react";
import { Check, Database, FolderKanban, Loader2, Search, Users } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import type { SelectableProject } from "../ProjectContext";

type ProjectSwitcherModalProps = {
  isOpen: boolean;
  projects: SelectableProject[];
  selectedProjectId: string;
  isLoading: boolean;
  errorMessage: string | null;
  onSelect: (projectId: string) => void;
  onClose: () => void;
};

type ProjectGroup = {
  label: string;
  projects: SelectableProject[];
};

/**
 * The management line shown on a card: "Managed by you" when the current user
 * manages the project, otherwise the assigned project manager's name. Returns
 * `null` when the current user does not manage it and no PM is assigned — an
 * admin reaching every project should not be labelled as managing all of them.
 */
function getManagerLabel(project: SelectableProject): string | null {
  if (project.isManaged) return "Managed by you";

  const manager = project.manager;
  if (!manager) return null;

  const fullName = `${manager.firstName} ${manager.lastName}`.trim();
  return `Managed by ${fullName || manager.username}`;
}

function matchesSearch(project: SelectableProject, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return (
    project.name.toLowerCase().includes(term) || project.description.toLowerCase().includes(term)
  );
}

/** Renders a count, or nothing when the value is unknown at this access level. */
function CountChip({
  icon: Icon,
  count,
  singular,
}: {
  icon: typeof Users;
  count: number | null;
  singular: string;
}) {
  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-app-text-muted">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {count} {count === 1 ? singular : `${singular}s`}
    </span>
  );
}

function ProjectCard({
  project,
  isSelected,
  onSelect,
}: {
  project: SelectableProject;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const managerLabel = getManagerLabel(project);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className={[
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all",
        "focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
        isSelected
          ? "border-app-brand bg-app-brand-soft"
          : "border-app-border bg-app-surface hover:border-app-border-strong hover:shadow-lg",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            isSelected
              ? "bg-app-brand text-white"
              : "bg-app-surface-muted text-app-text-muted group-hover:text-app-text",
          ].join(" ")}
        >
          <FolderKanban className="h-5 w-5" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-app-text">{project.name}</span>

          {managerLabel ? (
            <span
              className={[
                "mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                project.isManaged
                  ? "bg-app-brand-soft text-app-brand-text"
                  : "bg-app-surface-muted text-app-text-muted",
              ].join(" ")}
            >
              {managerLabel}
            </span>
          ) : null}
        </span>

        {isSelected ? <Check className="h-4 w-4 shrink-0 text-app-brand" /> : null}
      </div>

      {project.description ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-app-text-muted">
          {project.description}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
        <CountChip icon={Users} count={project.memberCount} singular="member" />
        <CountChip icon={Database} count={project.sourceCount} singular="source" />
      </div>
    </button>
  );
}

/**
 * Project picker shown as a centred modal with a search field and a grid of
 * project cards.
 *
 * Focus trapping, Escape handling and focus restoration come from `Modal`. The
 * grid is exposed as a listbox so the selected project is announced, while the
 * cards themselves stay in the normal tab order — with a handful of projects
 * that reads better than a roving-tabindex grid.
 */
export function ProjectSwitcherModal({
  isOpen,
  projects,
  selectedProjectId,
  isLoading,
  errorMessage,
  onSelect,
  onClose,
}: ProjectSwitcherModalProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleProjects = useMemo(
    () => projects.filter((project) => matchesSearch(project, search)),
    [projects, search],
  );

  const groups = useMemo<ProjectGroup[]>(() => {
    const managed = visibleProjects.filter((project) => project.isManaged);
    const member = visibleProjects.filter((project) => !project.isManaged);

    return [
      { label: "Managed by you", projects: managed },
      { label: "Member of", projects: member },
    ].filter((group) => group.projects.length > 0);
  }, [visibleProjects]);

  // Enter from the search field picks the only remaining match, so filtering to
  // one project and confirming never needs the mouse.
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || visibleProjects.length !== 1) return;

    event.preventDefault();
    onSelect(visibleProjects[0].id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Switch project"
      description="Pick the project the whole app should be scoped to."
      size="xl"
      // The switcher's trigger lives in the sidebar, which on mobile is a
      // fixed drawer at z-[60] (SideBar.tsx). At the default z-50 the modal
      // renders under that drawer; raise it above the drawer below lg, and keep
      // the desktop stacking (z-50) unchanged where no drawer exists.
      zIndexClassName="z-[70] lg:z-50"
      titleId="project-switcher-title"
      descriptionId="project-switcher-description"
      closeLabel="Close project switcher"
      bodyClassName="px-7 pb-7 pt-5"
    >
      <Input
        ref={searchRef}
        type="search"
        aria-label="Search projects"
        autoComplete="off"
        placeholder="Search projects..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        icon={<Search className="h-4 w-4" />}
        className="mb-5"
      />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-5 py-4 text-sm text-app-danger-text">
          {errorMessage}
        </div>
      ) : !projects.length ? (
        <p className="py-12 text-center text-sm text-app-text-muted">No projects available yet.</p>
      ) : !visibleProjects.length ? (
        <p className="py-12 text-center text-sm text-app-text-muted">
          No projects match &ldquo;{search.trim()}&rdquo;.
        </p>
      ) : (
        <div
          role="listbox"
          aria-label="Projects"
          className="max-h-[52vh] space-y-6 overflow-y-auto pr-1"
        >
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-app-text-muted uppercase">
                {group.label}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isSelected={project.id === selectedProjectId}
                    onSelect={() => onSelect(project.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
