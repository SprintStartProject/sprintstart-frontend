import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  getDefaultRoute,
  getMatchingProtectedRoute,
  isOnboardingAccessible,
} from "../auth/accessPolicy";
import {
  clearRedirectTarget,
  extractFullPath,
  resolveRedirectTarget,
  retrieveRedirectTarget,
  storeRedirectTarget,
} from "../auth/redirectUtils";
import { isSkillLinkedToRole } from "../features/team-management/types";
import {
  getSkillAssessmentPromptState,
  getMyTeamOverview,
  hasCompletedSkillAssessment,
  getSkills,
} from "../services/teamManagementService";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { status, profile } = useAuth();
  const location = useLocation();

  const [needsSkillAssessment, setNeedsSkillAssessment] = useState(false);
  const [skillAssessmentUserId, setSkillAssessmentUserId] = useState<string | null>(null);
  const [checkingSkillAssessment, setCheckingSkillAssessment] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && location.pathname !== "/login") {
      clearRedirectTarget();
    }
  }, [status, location.pathname]);

  useEffect(() => {
    async function checkSkillAssessment() {
      if (status !== "authenticated" || !profile?.id) {
        setNeedsSkillAssessment(false);
        setSkillAssessmentUserId(null);
        setCheckingSkillAssessment(false);
        return;
      }

      setCheckingSkillAssessment(true);

      const teamMember = await getMyTeamOverview();
      const completed = await hasCompletedSkillAssessment(teamMember.userId);
      const promptState = getSkillAssessmentPromptState(teamMember.userId);
      const allSkills = await getSkills();

      const hasSkillsForRoles =
        !!teamMember &&
        teamMember.roles.some((role) =>
          allSkills.some(
            (skill) => skill.status === "ACTIVE" && isSkillLinkedToRole(skill, role.id),
          ),
        );

      setSkillAssessmentUserId(teamMember.userId);
      setNeedsSkillAssessment(
        !!teamMember && hasSkillsForRoles && !completed && promptState === null,
      );

      setCheckingSkillAssessment(false);
    }

    void checkSkillAssessment();
  }, [status, profile?.id]);

  if (status === "loading" || checkingSkillAssessment) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-app-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-brand border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated" && location.pathname !== "/login") {
    const fullPath = extractFullPath(location);
    storeRedirectTarget(fullPath);
    const search = new URLSearchParams();
    search.set("redirect", fullPath);

    return <Navigate to={`/login?${search.toString()}`} state={{ from: location }} replace />;
  }

  if (status === "authenticated") {
    if (location.pathname === "/login") {
      const searchParams = new URLSearchParams(location.search);
      const storedTarget = retrieveRedirectTarget();
      const fallback = getDefaultRoute(profile);

      const destination = resolveRedirectTarget({
        searchParams,
        locationState: location.state,
        sessionTarget: storedTarget,
        fallback,
      });

      return <Navigate to={destination} replace />;
    }

    // If Keycloak redirected back to "/" or base URL, restore the stored deep link.
    // The stored target is only read here -- clearing it is left to the effect above,
    // which runs after the navigation commits. Clearing during render would make the
    // restore depend on how often React invokes this component: under StrictMode the
    // body runs twice, and a first pass that emptied the storage would leave the second
    // pass with nothing to restore.
    const currentFullPath = extractFullPath(location);
    const storedTarget = retrieveRedirectTarget();
    if (storedTarget && storedTarget !== currentFullPath) {
      if (location.pathname === "/" && storedTarget !== "/") {
        return <Navigate to={storedTarget} replace />;
      }
      // If the path matches but the hash fragment was stripped by OAuth, restore full path
      if (storedTarget.startsWith(location.pathname) && storedTarget.includes("#")) {
        return <Navigate to={storedTarget} replace />;
      }
    }
  }

  if (
    status === "authenticated" &&
    profile?.id &&
    !checkingSkillAssessment &&
    needsSkillAssessment &&
    (!skillAssessmentUserId || getSkillAssessmentPromptState(skillAssessmentUserId) === null) &&
    location.pathname !== "/skill-wizard"
  ) {
    return <Navigate to="/skill-wizard" replace />;
  }

  // Once onboarding is completed the user is promoted and the onboarding UI is gone:
  // block direct URL access to /onboarding and /onboarding/:stepId. The flag only
  // refreshes on reload (the auth profile is not refetched mid-session), so the
  // completion celebration still shows right after the final check.
  if (
    status === "authenticated" &&
    getMatchingProtectedRoute(location.pathname) === "/onboarding" &&
    !isOnboardingAccessible(profile)
  ) {
    return <Navigate to={getDefaultRoute(profile)} replace />;
  }

  return <>{children}</>;
}
