export type SourceSystem = "GITHUB" | "JIRA" | "UPLOAD";

export type IngestionRunStatus = "RUNNING" | "SUCCESS" | "FAILED";

export type ArtifactType =
    | "COMMIT"
    | "FILE"
    | "ISSUE"
    | "PULL_REQUEST";

export type IngestionRun = {
    runId: string;
    sourceSystem: SourceSystem;
    startedAt: string;
    finishedAt: string | null;
    ingestedCount: number;
    updatedCount: number;
    failedCount: number;
    status: IngestionRunStatus;
};

export type FailedArtifact = {
    artifactIdentifier: string;
    reason: string;
};

export type SourceIngestionStatus = {
    sourceSystem: SourceSystem;
    lastRunTime: string | null;
    ingestedCount: number;
    updatedCount: number;
    failedCount: number;
    failedItems: FailedArtifact[];
};