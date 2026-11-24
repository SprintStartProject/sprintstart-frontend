import { apiClient } from "./apiClient";
import type {
  AliasLink,
  MembersOverview,
  RiskMap,
  RiskQuery,
  Snapshot,
  SnapshotComparison,
  SnapshotSummary,
  StudyExport,
} from "./offboardingTypes";

/** The query string of a risk request: each leaving person as its own `leaving` parameter. */
function riskSearchParams(query: RiskQuery): string {
  const params = new URLSearchParams();
  query.leaving.forEach((person) => params.append("leaving", person));
  if (query.asOf) params.set("asOf", query.asOf);
  if (query.reviewWeight !== undefined) params.set("reviewWeight", String(query.reviewWeight));
  if (query.ranking) params.set("ranking", query.ranking);
  if (query.knowledge) params.set("knowledge", query.knowledge);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  return params.toString();
}

function base(projectId: string): string {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/offboarding`;
}

/**
 * What a project loses when people leave. Every call carries the project it asks about, and
 * failures propagate: a ranking that could not be computed must not look like one with no risk.
 */
export const offboardingService = {
  /** Ranks the files that lose the people who know them when [query]'s people leave. */
  async fetchRiskMap(projectId: string, query: RiskQuery): Promise<RiskMap> {
    return await apiClient.fetch<RiskMap>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/offboarding/risk?${riskSearchParams(query)}`,
    );
  },

  /**
   * Lists the project's members with the commit emails and logins that are theirs, found by their
   * registered email or declared GitHub login. A member with none cannot be ranked.
   */
  async fetchMembers(projectId: string): Promise<MembersOverview> {
    return await apiClient.fetch<MembersOverview>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/offboarding/identities/members`,
    );
  },
  /** Stores the ranking of [query] under an optional label and returns it. */
  async saveSnapshot(projectId: string, query: RiskQuery, label: string): Promise<Snapshot> {
    const params = new URLSearchParams(riskSearchParams(query));
    if (label.trim()) params.set("label", label.trim());
    return await apiClient.fetch<Snapshot>(`${base(projectId)}/risk/snapshots?${params}`, {
      method: "POST",
    });
  },

  /** The stored risk maps, newest first, without their rankings. */
  async fetchSnapshots(projectId: string): Promise<SnapshotSummary[]> {
    return await apiClient.fetch<SnapshotSummary[]>(`${base(projectId)}/risk/snapshots`);
  },

  /** Removes a stored risk map. */
  async deleteSnapshot(projectId: string, snapshotId: string): Promise<void> {
    await apiClient.fetch<void>(
      `${base(projectId)}/risk/snapshots/${encodeURIComponent(snapshotId)}`,
      { method: "DELETE" },
    );
  },

  /** How far two stored rankings agree and which files moved most. */
  async compareSnapshots(
    projectId: string,
    left: string,
    right: string,
  ): Promise<SnapshotComparison> {
    const params = new URLSearchParams({ left, right });
    return await apiClient.fetch<SnapshotComparison>(
      `${base(projectId)}/risk/snapshots/compare?${params}`,
    );
  },

  /** Confirms that [alias] and [person] are one developer. */
  async linkIdentities(projectId: string, link: AliasLink): Promise<AliasLink[]> {
    return await apiClient.fetch<AliasLink[]>(`${base(projectId)}/identities/links`, {
      method: "PUT",
      body: JSON.stringify(link),
    });
  },

  /** Takes back the link that folds [alias] into a person. */
  async unlinkIdentity(projectId: string, alias: string): Promise<void> {
    const params = new URLSearchParams({ alias });
    await apiClient.fetch<void>(`${base(projectId)}/identities/links?${params}`, {
      method: "DELETE",
    });
  },

  /** Every stored risk map with each person pseudonymised. */
  async exportStudy(projectId: string): Promise<StudyExport> {
    return await apiClient.fetch<StudyExport>(`${base(projectId)}/export`);
  },
};
