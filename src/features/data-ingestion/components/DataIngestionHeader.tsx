import { Database, RefreshCw } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { ProjectSelect } from "../../projects/components/ProjectSelect";
import type { AdminProject } from "../../../services/projectService";

type DataIngestionHeaderProps = {
    isLoading: boolean;
    projects: AdminProject[];
    selectedProjectId: string;
    isLoadingProjects: boolean;
    projectErrorMessage: string | null;
    onProjectChange: (projectId: string) => void;
    onRefresh: () => void;
    showProjectSelect?: boolean;
};

export function DataIngestionHeader({
    isLoading,
    projects,
    selectedProjectId,
    isLoadingProjects,
    projectErrorMessage,
    onProjectChange,
    onRefresh,
    showProjectSelect = true,
}: DataIngestionHeaderProps) {
    return (
        <header className="border-b border-app-border bg-app-bg">
            <div className="app-page-frame py-6">
                <PageHeader
                    icon={Database}
                    title="Data Ingestion"
                    subtitle="Manage connected sources, indexed artifacts and ingestion runs."
                    actions={
                        <>
                            {showProjectSelect && (
                                <ProjectSelect
                                    projects={projects}
                                    selectedProjectId={selectedProjectId}
                                    isLoading={isLoadingProjects}
                                    errorMessage={projectErrorMessage}
                                    onChange={onProjectChange}
                                />
                            )}

                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isLoading}
                                className="flex items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={16}
                                    className={isLoading ? "animate-spin" : ""}
                                />
                                Refresh
                            </button>
                        </>
                    }
                />
            </div>
        </header>
    );
}
