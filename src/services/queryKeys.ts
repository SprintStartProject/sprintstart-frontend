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
    // Users and projects on the Access Management page are not independent:
    // a user's `projects` field is corrected against the freshly fetched
    // project list at load time, and a project update patches specific users'
    // `projects` in place without touching their `projectIds`. Keeping both
    // under one cache entry is what makes that patch stick instead of being
    // silently overwritten by a re-derivation on the next render — unlike
    // `admin.users()`/`admin.projects()` above, which stay independent, raw
    // reads for callers (like the dashboard's user overview widget) that don't
    // need the cross-referencing.
    overview: () => ["admin", "overview"] as const,
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
    myStatuses: () => ["onboarding", "my-status"] as const,
    myStatus: (userId: string) => ["onboarding", "my-status", userId] as const,
    unseenSkipAnswers: (userId: string) => ["onboarding", "unseen-skip-answers", userId] as const,
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
    // Not scoped by user id, like `atlassianCredentials.mine` above: the
    // backend already answers "mine" from the auth token, and
    // `queryClient.clear()` on logout covers a session change.
    pending: () => ["attestations", "pending"] as const,
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
    // The hire's own questions across every project, not scoped by project id
    // like the three above — see `atlassianCredentials.mine` for why no user
    // id either.
    mine: () => ["knowledge-request", "mine"] as const,
  },
  onboardingMetrics: {
    project: (projectId: string) => ["onboarding-metrics", "project", projectId] as const,
  },
} as const;
