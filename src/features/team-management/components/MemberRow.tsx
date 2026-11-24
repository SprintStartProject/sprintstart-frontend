import { Check, Minus, Plus } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { fullName } from "../roleRules";
import type { TeamOverviewUser } from "../../../services/teamManagementTypes";

type MemberRowProps = {
  user: TeamOverviewUser;
  /** Ticked right now. */
  checked: boolean;
  /** Held the role when it was opened. */
  heldBefore: boolean;
  disabled: boolean;
  onToggle: (userId: string) => void;
};

type Mark = "adding" | "removing" | "holding" | "none";

/** The two pending states are told apart from the settled ones; they show what save will do. */
function markOf(checked: boolean, heldBefore: boolean): Mark {
  if (checked) return heldBefore ? "holding" : "adding";
  return heldBefore ? "removing" : "none";
}

const ROW_TONE: Record<Mark, string> = {
  adding: "bg-app-success-bg",
  removing: "bg-app-danger-bg",
  holding: "bg-app-brand-soft/60 hover:bg-app-brand-soft",
  none: "hover:bg-app-surface-hover",
};

const BOX_TONE: Record<Mark, string> = {
  adding: "border-app-success-border bg-app-success-bg text-app-success-text",
  removing: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  holding: "border-app-brand bg-app-brand text-app-text-inverse",
  none: "border-app-border bg-app-surface",
};

const BADGE_TONE: Partial<Record<Mark, string>> = {
  adding: "bg-app-success-solid/15 text-app-success-text",
  removing: "bg-app-danger-solid/15 text-app-danger-text",
};

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "adding") return <Plus className="h-3.5 w-3.5" />;
  if (mark === "removing") return <Minus className="h-3.5 w-3.5" />;
  if (mark === "holding") return <Check className="h-3.5 w-3.5" />;
  return null;
}

/** The box that is actually seen, because a native checkbox cannot show three different marks. */
function MarkBox({ mark }: { mark: Mark }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-focus peer-focus-visible:outline-solid ${BOX_TONE[mark]}`}
    >
      <MarkIcon mark={mark} />
    </span>
  );
}

function MemberName({ user }: { user: TeamOverviewUser }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-app-text">{fullName(user)}</span>
      <span className="mt-0.5 block truncate text-xs text-app-text-muted">
        {user.roles.length === 0 ? "No roles" : user.roles.map((role) => role.name).join(", ")}
      </span>
    </span>
  );
}

/** Where they are in onboarding — who is being given the role, not only their name. */
function MemberProgress({ user }: { user: TeamOverviewUser }) {
  const progress = Math.round((user.progressPercentage ?? 0) * 100);

  return (
    <span className="hidden w-32 shrink-0 text-right text-xs text-app-text-muted sm:block">
      <span className="block truncate">{user.currentPhase?.title ?? "Not started"}</span>
      <span className="block tabular-nums">{progress}% through</span>
    </span>
  );
}

function PendingBadge({ mark }: { mark: Mark }) {
  const tone = BADGE_TONE[mark];
  if (!tone) return null;

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {mark === "adding" ? "Will be added" : "Will be removed"}
    </span>
  );
}

/** One person in the open role's member list: tick to give the role, untick to take it away. */
export function MemberRow({ user, checked, heldBefore, disabled, onToggle }: MemberRowProps) {
  const mark = markOf(checked, heldBefore);

  return (
    <li>
      <label
        className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${ROW_TONE[mark]}`}
      >
        {/* The real control, kept for keyboard and screen readers. */}
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggle(user.userId)}
          className="peer sr-only"
        />
        <MarkBox mark={mark} />
        <UserAvatar
          profileIcon={user.profileIcon}
          fallbackName={fullName(user)}
          seed={user.userId}
          size={32}
        />
        <MemberName user={user} />
        <MemberProgress user={user} />
        <PendingBadge mark={mark} />
      </label>
    </li>
  );
}
