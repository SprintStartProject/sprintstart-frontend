import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
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

interface LocationState {
    from?: {
        pathname: string;
    };
}

export function AuthGuard({ children }: AuthGuardProps) {
    const { status, profile } = useAuth();
    const location = useLocation();

    const [needsSkillAssessment, setNeedsSkillAssessment] = useState(false);
    const [skillAssessmentUserId, setSkillAssessmentUserId] = useState<string | null>(null);
    const [checkingSkillAssessment, setCheckingSkillAssessment] = useState(false);

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
                        (skill) =>
                            skill.status === "ACTIVE" &&
                            isSkillLinkedToRole(skill, role.id),
                    ),
                );

            setSkillAssessmentUserId(teamMember.userId);
            setNeedsSkillAssessment(
                !!teamMember &&
                    hasSkillsForRoles &&
                    !completed &&
                    promptState === null,
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
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (status === "authenticated" && location.pathname === "/login") {
        const state = location.state as LocationState;
        const from = state?.from?.pathname || "/";

        return <Navigate to={from} replace />;
    }

    if (
        status === "authenticated" &&
        profile?.id &&
        !checkingSkillAssessment &&
        needsSkillAssessment &&
        (!skillAssessmentUserId ||
            getSkillAssessmentPromptState(skillAssessmentUserId) === null) &&
        location.pathname !== "/skill-wizard"
    ) {
        return <Navigate to="/skill-wizard" replace />;
    }

    return <>{children}</>;
}
