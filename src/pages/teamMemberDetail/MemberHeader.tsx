import { MemberHero } from "../../features/pm-area/components/MemberHero";
import { MemberSignals } from "../../features/pm-area/components/MemberSummary";
import { useTeamRoster } from "../../features/pm-area/useTeamRoster";
import { MemberGapsPanel } from "../../features/team-management/components/detail/MemberGapsPanel";
import type { TeamOverviewUser } from "../../services/teamManagementTypes";
import { BackToTeam } from "./MemberParts";
import type { MemberView } from "./memberView";
import type { MemberPageModel } from "./useMemberPage";

type MemberHeroBlockProps = {
  user: TeamOverviewUser;
  model: MemberPageModel;
  /** The figures and phases at the top take the manager down to the path through this. */
  onShowJourney: () => void;
};

export function MemberHeroBlock({ user, model, onShowJourney }: MemberHeroBlockProps) {
  const { data: roster } = useTeamRoster();
  const { data, roles } = model;

  return (
    <div className="mb-5">
      <MemberHero
        member={user}
        roster={roster ?? []}
        assignableRoles={roles.assignable}
        savingRoleId={roles.savingRoleId}
        onAddRole={(roleId) => void roles.add(roleId)}
        onRemoveRole={roles.setRoleToRemove}
        figures={
          <MemberSignals
            path={data.onboardingPath}
            feedback={data.feedbackItems}
            skillLevels={data.skillLevels}
            knowledgeGapCount={data.knowledgeGaps.length}
            onOpen={onShowJourney}
          />
        }
      />
    </div>
  );
}

type MemberInsightsProps = {
  model: MemberPageModel;
  view: MemberView;
  onOpenKnowledgeGap: (gapId: string) => void;
};

/**
 * Below the journey rather than beside it: the graph needs the width. Side by side, each its own
 * height: stacked without a gap the two cards ran into each other.
 */
export function MemberInsights({ model, view, onOpenKnowledgeGap }: MemberInsightsProps) {
  return (
    <aside aria-label="Member insights" className="grid items-start gap-5 md:grid-cols-2">
      <MemberGapsPanel
        skillLevels={model.data.skillLevels}
        knowledgeGaps={view.topGaps}
        onOpenKnowledgeGap={onOpenKnowledgeGap}
      />
    </aside>
  );
}

export function MemberNotShown({
  loading,
  loadError,
  onBack,
}: {
  loading: boolean;
  loadError: string;
  onBack: () => void;
}) {
  return (
    <section aria-label="Team member">
      <BackToTeam onBack={onBack} />
      {loading ? (
        <div className="flex min-h-96 items-center justify-center">
          <p className="text-sm text-app-text-muted">Loading team member...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-app-border bg-app-surface p-8">
          <p className="text-sm text-app-text">
            {loadError
              ? `The team member could not be loaded: ${loadError}`
              : "Team member not found."}
          </p>
        </div>
      )}
    </section>
  );
}
