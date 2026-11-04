import { useEffect, useRef, useState } from "react";
import type { KnowledgeGap } from "../../services/knowledgeGapTypes";
import type { OnboardingPathEndpoint } from "../../services/onboardingTypes";
import type { ProjectRole, TeamOverviewUser } from "../../services/teamManagementTypes";
import { knowledgeGapService } from "../../services/knowledgeGapService";
import {
  getProjectRoles,
  getTeamMember,
  getUserOnboardingFeedback,
  getUserOnboardingPath,
  getUserSkillLevels,
  type OnboardingFeedback,
  type UserSkillLevel,
} from "../../services/teamManagementService";
import { gapsOwnedBy } from "./memberRules";

type Loaded = {
  user: TeamOverviewUser | undefined;
  roles: ProjectRole[];
  skillLevels: UserSkillLevel[];
  path: OnboardingPathEndpoint | null;
  gaps: KnowledgeGap[];
  feedback: OnboardingFeedback[];
};

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Everything one member's page shows, read together. The feedback is allowed to fail alone. */
async function loadAll(
  userId: string,
  projectId: string,
  onFeedbackError: (message: string) => void,
): Promise<Loaded> {
  const [user, roles, skillLevels, path, overview] = await Promise.all([
    getTeamMember(userId),
    getProjectRoles(),
    getUserSkillLevels(userId),
    getUserOnboardingPath(userId),
    knowledgeGapService.fetchKnowledgeGaps(projectId),
  ]);
  let feedback: OnboardingFeedback[] = [];
  try {
    feedback = await getUserOnboardingFeedback(userId);
  } catch (error) {
    onFeedbackError(errorText(error, "Unable to load feedback."));
  }

  return {
    user,
    roles,
    skillLevels,
    path,
    gaps: gapsOwnedBy(overview.gaps, user?.userId),
    feedback,
  };
}

/** The loaded profile, one piece of state each, and the flags around loading it. */
function useMemberState() {
  const [user, setUser] = useState<TeamOverviewUser | undefined>(undefined);
  const [availableRoles, setAvailableRoles] = useState<ProjectRole[]>([]);
  const [skillLevels, setSkillLevels] = useState<UserSkillLevel[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<OnboardingFeedback[]>([]);
  const [onboardingPath, setOnboardingPath] = useState<OnboardingPathEndpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  // The feedback *load* failure, shown inline where the list would be; every action outcome on
  // this page is a toast instead.
  const [feedbackError, setFeedbackError] = useState("");

  return {
    user,
    setUser,
    availableRoles,
    setAvailableRoles,
    skillLevels,
    setSkillLevels,
    knowledgeGaps,
    setKnowledgeGaps,
    feedbackItems,
    setFeedbackItems,
    onboardingPath,
    setOnboardingPath,
    loading,
    setLoading,
    loadError,
    setLoadError,
    loadingFeedback,
    setLoadingFeedback,
    feedbackError,
    setFeedbackError,
  };
}

type MemberState = ReturnType<typeof useMemberState>;

/** Loads the profile when the member or the project changes; a late answer is dropped. */
function useInitialLoad(state: MemberState, userId: string | undefined, projectId: string) {
  const { setLoading, setLoadError, setLoadingFeedback, setFeedbackError } = state;
  const { setUser, setAvailableRoles, setSkillLevels, setKnowledgeGaps } = state;
  const { setFeedbackItems, setOnboardingPath } = state;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");
      setLoadingFeedback(true);
      try {
        const data = await loadAll(userId, projectId, (message) => {
          if (!cancelled) setFeedbackError(message);
        });
        if (cancelled) return;
        setUser(data.user);
        setAvailableRoles(data.roles);
        setSkillLevels(data.skillLevels);
        setKnowledgeGaps(data.gaps);
        setFeedbackItems(data.feedback);
        setOnboardingPath(data.path);
      } catch (error) {
        if (cancelled) return;
        setUser(undefined);
        setLoadError(errorText(error, "The team member could not be loaded."));
      } finally {
        if (!cancelled) {
          setLoadingFeedback(false);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // Knowledge gaps are project-scoped, so switching projects has to reload them -- otherwise
    // this page keeps showing the previous project's gaps for the member.
  }, [
    userId,
    projectId,
    setLoading,
    setLoadError,
    setLoadingFeedback,
    setFeedbackError,
    setUser,
    setAvailableRoles,
    setSkillLevels,
    setKnowledgeGaps,
    setFeedbackItems,
    setOnboardingPath,
  ]);
}

/** The three refreshes that follow every PM action, each dropped when the page moved on. */
function useRefreshers(state: MemberState, userId: string | undefined) {
  const { setUser, setFeedbackItems, setOnboardingPath } = state;
  const { setLoadingFeedback, setFeedbackError } = state;
  // Which member the page is about right now, for the refreshes to check themselves against.
  const shownUserId = useRef(userId);
  useEffect(() => {
    shownUserId.current = userId;
  }, [userId]);
  const isShown = (id: string) => shownUserId.current === id;

  async function refreshMember() {
    if (!userId) return;
    const memberData = await getTeamMember(userId);
    if (isShown(userId)) setUser(memberData);
  }

  async function refreshFeedback() {
    if (!userId) return;
    const forUser = userId;

    setLoadingFeedback(true);
    setFeedbackError("");
    try {
      const feedback = await getUserOnboardingFeedback(forUser);
      if (isShown(forUser)) setFeedbackItems(feedback);
    } catch (error) {
      if (isShown(forUser)) setFeedbackError(errorText(error, "Unable to load feedback."));
    } finally {
      if (isShown(forUser)) setLoadingFeedback(false);
    }
  }

  async function refreshOnboardingPath() {
    if (!userId) return;
    const path = await getUserOnboardingPath(userId);
    if (isShown(userId)) setOnboardingPath(path);
  }

  return { isShown, refreshMember, refreshFeedback, refreshOnboardingPath };
}

/**
 * One member's profile data and the refreshes that follow every PM action.
 *
 * A response for the member (or project) the page has since moved away from is dropped: it would
 * otherwise render member A's journey, with A's step and skip ids, under B's URL -- after which
 * the next action sends A's ids.
 */
export function useMemberData(userId: string | undefined, selectedProjectId: string) {
  const state = useMemberState();
  useInitialLoad(state, userId, selectedProjectId);
  const refreshers = useRefreshers(state, userId);

  return {
    user: state.user,
    setUser: state.setUser,
    availableRoles: state.availableRoles,
    skillLevels: state.skillLevels,
    knowledgeGaps: state.knowledgeGaps,
    feedbackItems: state.feedbackItems,
    setFeedbackItems: state.setFeedbackItems,
    onboardingPath: state.onboardingPath,
    loading: state.loading,
    loadError: state.loadError,
    loadingFeedback: state.loadingFeedback,
    feedbackError: state.feedbackError,
    ...refreshers,
  };
}

export type MemberData = ReturnType<typeof useMemberData>;
