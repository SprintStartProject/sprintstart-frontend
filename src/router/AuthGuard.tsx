import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { PageShellSkeleton } from "../components/layout/PageShell";
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

      // Nothing here may throw past this point: the guard renders a loading skeleton
      // while it runs, so an unhandled rejection leaves the whole app on that skeleton.
      // A user whose overview cannot be read (no onboarding path, or a role that may not
      // read it) simply has no assessment to prompt for — that is not a reason to lock
      // them out of the app.
      try {
        const teamMember = await getMyTeamOverview();
        const promptState = getSkillAssessmentPromptState(teamMember.userId);
        const [completed, allSkills] = await Promise.all([
          hasCompletedSkillAssessment(teamMember.userId),
          getSkills(),
        ]);

        const hasSkillsForRoles = teamMember.roles.some((role) =>
          allSkills.some(
            (skill) => skill.status === "ACTIVE" && isSkillLinkedToRole(skill, role.id),
          ),
        );

        setSkillAssessmentUserId(teamMember.userId);
        setNeedsSkillAssessment(hasSkillsForRoles && !completed && promptState === null);
      } catch (error) {
        console.warn("Skipping the skill assessment check", error);
        setSkillAssessmentUserId(null);
        setNeedsSkillAssessment(false);
      }

      setCheckingSkillAssessment(false);
    }

    void checkSkillAssessment();
  }, [status, profile?.id]);

  // A logout return, or a failed silent SSO check, keeps that load blank until auth
  // settles, just like its suppressed splash -- see `AuthProvider`'s initial state for
  // how the boot script's flag becomes this.
  if (status === "signingOut") return null;

  // `PageShellSkeleton` previews the header/band every *other* route settles into --
  // wrong here, since `LoginPage` has no header at all. Landing on `/login` while still
  // `loading` (the redirect chain above can take a moment to resolve once it is back)
  // would otherwise flash that mismatched band right before the login card replaces it.
  if (status === "loading" && location.pathname === "/login") return null;

  if (status === "loading" || checkingSkillAssessment) {
    return <PageShellSkeleton />;
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
