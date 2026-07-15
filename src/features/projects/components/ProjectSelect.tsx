import { ChevronDown, FolderKanban } from "lucide-react";
import type { AdminProject } from "../../../services/projectService";

type ProjectSelectProps = {
    projects: AdminProject[];
    selectedProjectId: string;
    isLoading?: boolean;
    errorMessage?: string | null;
    onChange: (projectId: string) => void;
};

export function ProjectSelect({
    projects,
    selectedProjectId,
    isLoading = false,
    errorMessage = null,
    onChange,
}: ProjectSelectProps) {
    const isDisabled =
        isLoading || projects.length === 0 || Boolean(errorMessage);
    const selectedValue = isDisabled ? "" : selectedProjectId;

    return (
        <label className="relative inline-flex h-11 w-full items-center sm:w-72">
            <span className="sr-only">Project</span>
            <FolderKanban className="pointer-events-none absolute left-3 h-4 w-4 text-app-text-muted" />
            <select
                value={selectedValue}
                disabled={isDisabled}
                title={errorMessage ?? "Project"}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full appearance-none truncate rounded-xl border border-app-border bg-app-surface py-2 pl-10 pr-9 text-sm font-medium text-app-text outline-none transition hover:bg-app-surface-hover focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:text-app-text-disabled disabled:opacity-70"
            >
                {isLoading ? (
                    <option value="">Loading projects...</option>
                ) : errorMessage ? (
                    <option value="">Projects unavailable</option>
                ) : projects.length === 0 ? (
                    <option value="">No projects</option>
                ) : (
                    projects.map((project) => (
                        <option key={project.id} value={project.id}>
                            {project.name}
                        </option>
                    ))
                )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-app-text-disabled" />
        </label>
    );
}