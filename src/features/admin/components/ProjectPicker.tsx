import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FolderKanban, Plus, Search } from "lucide-react";
import { Button, type ButtonVariant } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { ProjectMonogram } from "../../projects/components/ProjectMonogram";
import { getManagerName, getProjectUsersCount, pluralize } from "../data";
import type { ProjectOverview } from "../types";

type ProjectPickerProps = {
  /** Every project; the ones in `excludedIds` are left out of the list. */
  projects: ProjectOverview[];
  excludedIds: Set<string>;
  /** Label on the button that opens the picker. */
  label: string;
  icon?: ReactNode;
  triggerVariant?: ButtonVariant;
  /** Heading inside the popover, e.g. "Add to project" or "Move to project". */
  title: string;
  /** One line under the heading, e.g. what the choice replaces. */
  hint?: string;
  /** The project a request is currently running for, if any. */
  pendingProjectId: string | null;
  disabled?: boolean;
  /**
   * Called with the chosen project. Resolve `true` once it is saved to close the
   * picker; `false` (cancelled or failed) keeps it open for another try.
   */
  onSelect: (projectId: string) => Promise<boolean>;
  className?: string;
};

/**
 * Button plus searchable popover for choosing a project to assign.
 *
 * The popover flips above the button when the drawer leaves no room below it,
 * and Escape or a click outside closes only the picker — the Escape listener
 * stops propagation so the surrounding drawer does not close with it.
 */
export function ProjectPicker({
  projects,
  excludedIds,
  label,
  icon = <Plus className="h-4 w-4" />,
  triggerVariant = "secondary",
  title,
  hint,
  pendingProjectId,
  disabled = false,
  onSelect,
  className = "",
}: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({ dropUp: false, maxHeight: 384 });
  const hasPendingChange = pendingProjectId !== null;

  // On open, decide whether the picker drops down or flips up, and how tall it
  // may grow, from the room left around the button inside the drawer's viewport
  // — so it never spills below the fold and forces an extra scroll to reach it.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const margin = 16;
      const spaceBelow = window.innerHeight - anchor.bottom - margin;
      const spaceAbove = anchor.top - margin;
      const dropUp = spaceBelow < 260 && spaceAbove > spaceBelow;

      setPlacement({
        dropUp,
        maxHeight: Math.max(200, Math.min(384, dropUp ? spaceAbove : spaceBelow)),
      });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const dismiss = () => {
      setIsOpen(false);
      setSearch("");
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) dismiss();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  const trimmedSearch = search.trim();

  const options = useMemo(() => {
    const normalized = trimmedSearch.toLowerCase();

    return projects
      .filter((project) => !excludedIds.has(project.id))
      .filter(
        (project) => normalized.length === 0 || project.name.toLowerCase().includes(normalized),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [projects, excludedIds, trimmedSearch]);

  const select = async (projectId: string) => {
    if (hasPendingChange) return;

    if (await onSelect(projectId)) {
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div className={`relative ${className}`.trim()} ref={anchorRef}>
      <Button
        variant={triggerVariant}
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled || hasPendingChange}
        loading={hasPendingChange}
        icon={icon}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full sm:w-auto"
      >
        {label}
      </Button>

      {isOpen && (
        <motion.div
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: placement.dropUp ? 6 : -6, scale: 0.98 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
          style={{ maxHeight: placement.maxHeight }}
          className={`absolute right-0 z-30 flex w-[min(calc(100vw-2rem),22rem)] flex-col rounded-2xl border border-app-border bg-app-surface p-2.5 shadow-lg ${
            placement.dropUp ? "bottom-full mb-2 origin-bottom-right" : "mt-2 origin-top-right"
          }`}
        >
          <p className="shrink-0 px-1 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            {title}
          </p>
          {hint && <p className="mt-1 shrink-0 px-1 text-xs text-app-text-muted">{hint}</p>}

          <div className="my-2 shrink-0">
            <Input
              size="sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects..."
              aria-label="Search projects"
              disabled={hasPendingChange}
              icon={<Search className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {options.length > 0 ? (
              options.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void select(project.id)}
                  disabled={hasPendingChange}
                  className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition-all hover:border-app-brand-border-strong hover:bg-app-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ProjectMonogram projectId={project.id} name={project.name} size="sm" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-app-text">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-app-text-muted">
                      {pluralize(getProjectUsersCount(project), "member")} ·{" "}
                      {project.manager ? getManagerName(project.manager) : "No manager"}
                    </span>
                  </span>

                  {pendingProjectId === project.id ? (
                    <Spinner size="md" silent className="shrink-0" />
                  ) : (
                    <Plus
                      className="h-4 w-4 shrink-0 text-app-brand opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                <FolderKanban className="h-5 w-5 text-app-text-disabled" aria-hidden="true" />
                <p className="text-sm text-app-text-muted">
                  {trimmedSearch
                    ? `No projects match "${trimmedSearch}".`
                    : "No other projects available."}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
