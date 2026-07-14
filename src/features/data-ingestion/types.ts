import type { LucideIcon } from "lucide-react";

export type SourceSystem = "GITHUB" | "JIRA" | "UPLOAD";

export type IngestionRunStatus =
    | "CONNECTED"
    | "RUNNING"
    | "COMPLETED"
    | "PARTIAL"
    | "FAILED";

export type ArtifactType = "COMMIT" | "FILE" | "ISSUE" | "PULL_REQUEST";

export type IngestionRun = {
    runId: string;
    sourceSystem: SourceSystem;
    startedAt: string;
    finishedAt: string | null;
    ingestedCount: number;
    updatedCount: number;
    failedCount: number;
    status: IngestionRunStatus;
    failedItems: FailedArtifact[];
};

export type FailedArtifact = {
    artifactIdentifier: string;
    reason: string;
};

export type GithubRepositoryReference = {
    owner: string;
    name: string;
};

export type SourceIngestionStatus = {
    sourceSystem: SourceSystem;
    lastRunTime: string | null;
    ingestedCount: number;
    updatedCount: number;
    failedCount: number;
    status: IngestionRunStatus | null;
    failedItems: FailedArtifact[];
};

export type ActiveTab = "sources" | "artifacts" | "runs" | "connectors";

export type LoadingState = "idle" | "loading" | "success" | "error";

export type ConnectState = "idle" | "loading" | "success" | "error";

export type SourceStatus = "connected" | "running" | "warning";

export type SourceMeta = {
    name: string;
    type: string;
    icon: LucideIcon;
    description: string;
};

export type SourceDetailsSource = {
    sourceSystem: SourceSystem;
    name: string;
    type: string;
    status: SourceStatus;
    artifacts: number;
    lastSync: string;
    errors: number;
    latestIngestedCount?: number;
    latestUpdatedCount?: number;
    failedItems?: SourceIngestionStatus["failedItems"];

    /**
     * Optional fields can still exist on the page source object,
     * but the details panel does not render them because the backend
     * does not currently provide them.
     */
    description?: string;
    nextSync?: string;
};

export type DataSource = SourceDetailsSource & {
    sourceSystem: SourceSystem;
    icon: LucideIcon;
    status: SourceStatus;
    statusLabel: string;
    lastRunAt: string | null;
    latestIngestedCount: number;
    latestUpdatedCount: number;
    failedItems: SourceIngestionStatus["failedItems"];
};

export type SourceConnectMeta = SourceMeta;
