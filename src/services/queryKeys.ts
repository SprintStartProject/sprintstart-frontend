/**
 * Central query-key factory, shared by every migrated hook, invalidation call and
 * prefetch (sidebar hover/press). Keeping one factory is what makes those three
 * agree on a key without importing each other.
 *
 * Every project-scoped key carries the `projectId` and every user-scoped key
 * carries the `profile.id` explicitly, rather than leaving them implicit —
 * otherwise a project switch or a user switch would keep serving the previous
 * project's/user's cached data.
 */
export const queryKeys = {
  admin: {
    users: () => ["admin", "users"] as const,
    projects: () => ["admin", "projects"] as const,
    githubTokenNames: () => ["admin", "github-tokens"] as const,
  },
  attention: {
    byProject: (projectId: string) => ["attention", projectId] as const,
  },
  starterWork: {
    pool: () => ["starter-work", "pool"] as const,
    review: () => ["starter-work", "review"] as const,
    corpusIssues: (projectId: string) => ["starter-work", "corpus", projectId] as const,
  },
  profile: {
    mine: (userId: string) => ["profile", userId] as const,
  },
  onboarding: {
    myStatus: (userId: string) => ["onboarding", "my-status", userId] as const,
  },
  projectInsights: {
    byProjectIds: (projectIds: string) => ["project-insights", projectIds] as const,
  },
  atlassianCredentials: {
    // Not scoped by user id: `queryClient.clear()` on logout already keeps a
    // session change from serving the previous user's list, and threading
    // `profile.id` through would cost these two hooks their standalone,
    // auth-independent tests for no real protection.
    mine: () => ["atlassian-credentials"] as const,
  },
  knowledgeGaps: {
    mine: (projectId: string) => ["knowledge-gaps", "mine", projectId] as const,
    overview: (projectId: string) => ["knowledge-gaps", "overview", projectId] as const,
    detail: (projectId: string, gapId: string) =>
      ["knowledge-gaps", "detail", projectId, gapId] as const,
  },
  board: {
    byProject: (projectId: string) => ["board", projectId] as const,
  },
  attestations: {
    pending: (userId: string) => ["attestations", "pending", userId] as const,
  },
  knowledgeBase: {
    byProject: (projectId: string) => ["knowledge-base", projectId] as const,
  },
  faq: {
    groups: (projectId: string) => ["faq", "groups", projectId] as const,
    detail: (projectId: string, groupId: string) => ["faq", "detail", projectId, groupId] as const,
  },
  teamOverview: {
    // `projectId` is `null` for the unfiltered, org-wide read.
    filtered: (projectId: string | null) => ["team-overview", projectId ?? "all"] as const,
  },
  ingestion: {
    sourceStatuses: (projectId: string) => ["ingestion", "source-statuses", projectId] as const,
  },
  knowledgeRequest: {
    open: (projectId: string) => ["knowledge-request", "open", projectId] as const,
    answers: (projectId: string) => ["knowledge-request", "answers", projectId] as const,
    openCount: (projectId: string) => ["knowledge-request", "open-count", projectId] as const,
  },
  pmAttention: {
    byProject: (projectId: string) => ["pm-attention", projectId] as const,
  },
  onboardingMetrics: {
    project: (projectId: string) => ["onboarding-metrics", "project", projectId] as const,
  },
} as const;
