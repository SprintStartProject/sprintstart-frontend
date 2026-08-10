import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SkillWizard } from "../features/team-management/components/SkillWizard";
import {
  getSkillAssessmentPromptState,
  getSkills,
  getMyTeamOverview,
  markSkillAssessmentPromptCompleted,
  markSkillAssessmentPromptDismissed,
  saveUserSkillAssessments,
} from "../services/teamManagementService";
import type { CreateSkillAssessmentRequest } from "../services/teamManagementService";
import type { Skill, TeamOverviewUser } from "../features/team-management/types";
import { useAuth } from "../context/useAuth";

export function SkillWizardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [user, setUser] = useState<TeamOverviewUser | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentUserId = profile?.id;

    async function loadData() {
      if (!currentUserId) {
        setError("No logged in user found.");
        setLoading(false);
        return;
      }

      try {
        const [memberData, skillsData] = await Promise.all([getMyTeamOverview(), getSkills()]);

        if (!memberData) {
          setError("Team member not found.");
          return;
        }

        setUser(memberData);
        setSkills(skillsData);
      } catch {
        setError("Unable to load skill assessment data.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [profile?.id]);

  function handleClose() {
    if (user?.userId && getSkillAssessmentPromptState(user.userId) !== "completed") {
      markSkillAssessmentPromptDismissed(user.userId);
    }

    void navigate("/onboarding");
  }

  async function handleSubmit(assessments: CreateSkillAssessmentRequest[]) {
    await saveUserSkillAssessments(assessments);
    if (user?.userId) {
      markSkillAssessmentPromptCompleted(user.userId);
    }
    if (profile?.id && profile.id !== user?.userId) {
      markSkillAssessmentPromptCompleted(profile.id);
    }

    void navigate("/onboarding");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
        <p className="text-sm text-app-text-muted">Loading skill assessment...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-app-border bg-app-surface p-6 text-center shadow-lg">
          <p className="text-sm text-app-text-muted">{error ?? "Unknown error."}</p>

          <div className="mt-6 flex justify-center">
            <Link
              to="/onboarding"
              className="rounded-xl border border-app-border bg-app-bg px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface-hover"
            >
              Back to onboarding
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SkillWizard open user={user} skills={skills} onClose={handleClose} onSubmit={handleSubmit} />
  );
}
