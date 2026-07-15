import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  MessageSquareText,
  SkipForward,
  Users,
} from "lucide-react";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { getTeamOverview } from "../../../services/teamManagementService";
import type { TeamOverviewUser } from "../types";
import { TeamMemberCard } from "./TeamMemberCard";

type CountBadgeProps = {
  icon: ReactNode;
  count: number;
  label: string;
  variant: "soft" | "muted";
};

type TeamManagementWidgetProps = {
  projectId?: string;
};

function CountBadge({ icon, count, label, variant }: CountBadgeProps) {
  const base =
    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  const styles =
    variant === "soft"
      ? `${base} bg-app-brand-soft text-app-brand-text`
      : `${base} bg-app-surface-muted text-app-text-muted`;

  return (
    <span className={styles} title={label}>
      {icon}
      {count}
    </span>
  );
}

export function TeamManagementWidget({
  projectId = "",
}: TeamManagementWidgetProps) {
  const [users, setUsers] = useState<TeamOverviewUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isCurrentRequest = true;

    void Promise.resolve().then(async () => {
      if (!isCurrentRequest) return;

      setLoading(true);
      setError(false);

      try {
        const data = await getTeamOverview(
          undefined,
          undefined,
          projectId ? [projectId] : undefined,
        );
        if (!isCurrentRequest) return;

        setUsers(data);
      } catch {
        if (!isCurrentRequest) return;

        setError(true);
      } finally {
        if (isCurrentRequest) {
          setLoading(false);
        }
      }
    });

    return () => {
      isCurrentRequest = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Loader2 className="h-5 w-5 animate-spin text-app-brand" />
      </div>
    );
  }

  if (error || users.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">Could not load team data.</p>
      </div>
    );
  }

  const mostStuck = [...users]
    .sort((a, b) => {
      if (!a.currentStep?.startedAt) return 1;
      if (!b.currentStep?.startedAt) return -1;

      return (
        new Date(a.currentStep.startedAt).getTime() -
        new Date(b.currentStep.startedAt).getTime()
      );
    })
    .slice(0, 4);

  const pendingFeedbackCount = users.filter((user) => user.hasFeedback).length;
  const pendingSkipCount = users.filter(
    (user) => user.currentStep?.skip?.status === "PENDING",
  ).length;

  return (
    <ClickableCard
      onClick={() => void navigate("/team-management")}
      interactive={false}
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[a:hover]:!border-app-border has-[a:hover]:!bg-app-surface"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-app-brand" />
          <span className="text-sm font-semibold text-app-text">
            Team progress
          </span>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void navigate("/team-management");
          }}
          className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
        >
          See all ({users.length})
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {(pendingFeedbackCount > 0 || pendingSkipCount > 0) && (
        <div className="mb-4 flex items-center gap-2">
          {pendingFeedbackCount > 0 && (
            <CountBadge
              icon={<MessageSquareText className="h-3 w-3" />}
              count={pendingFeedbackCount}
              label={`${pendingFeedbackCount} unread feedback`}
              variant="soft"
            />
          )}
          {pendingSkipCount > 0 && (
            <CountBadge
              icon={<SkipForward className="h-3 w-3" />}
              count={pendingSkipCount}
              label={`${pendingSkipCount} open skip request${
                pendingSkipCount > 1 ? "s" : ""
              }`}
              variant="muted"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mostStuck.map((user) => (
          // TeamMemberCard is already a keyboard-accessible Link; this wrapper
          // only prevents its click from also triggering the widget background.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div key={user.userId} onClick={(event) => event.stopPropagation()}>
            <TeamMemberCard user={user} compact />
          </div>
        ))}
      </div>
    </ClickableCard>
  );
}
