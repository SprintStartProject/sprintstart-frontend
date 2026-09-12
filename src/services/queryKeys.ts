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
  githubTokens: {
    mine: (userId: string) => ["github-tokens", userId] as const,
  },
  atlassianCredentials: {
    mine: (userId: string) => ["atlassian-credentials", userId] as const,
  },
  knowledgeGaps: {
    mine: (userId: string) => ["knowledge-gaps", "mine", userId] as const,
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
} as const;
