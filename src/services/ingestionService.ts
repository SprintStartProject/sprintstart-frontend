import type {
    IngestionRun,
    SourceIngestionStatus,
} from "../types/ingestionTypes.ts";

/**
 * Fetches the most recent ingestion runs.
 *
 * @param limit - Maximum number of ingestion runs to fetch. Must be between 1 and 100.
 * @returns A promise resolving to an array of IngestionRun objects.
 * @throws Error if the backend request fails.
 */
export async function getIngestionRuns(limit = 50) {
    const res = await fetch(`/api/v1/ingestion-runs?limit=${limit}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error("Failed to load ingestion runs");
    }

    return res.json() as Promise<IngestionRun[]>;
}

/**
 * Fetches the latest ingestion status for all available source systems.
 *
 * @returns A promise resolving to an array of SourceIngestionStatus objects.
 * @throws Error if the backend request fails.
 */
export async function getIngestionStatus() {
    const res = await fetch(`/api/v1/ingestion-status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error("Failed to load ingestion status");
    }

    return res.json() as Promise<SourceIngestionStatus[]>;
}