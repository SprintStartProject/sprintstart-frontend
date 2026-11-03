import { UserX } from "lucide-react";
import { fullName, nameList } from "../roleRules";
import type { TeamOverviewUser } from "../types";

type UnassignedMembersHintProps = {
  /** The members nobody has given a role yet. */
  members: TeamOverviewUser[];
  /** The open role, when there is one; with it, one press shows them in its member list. */
  openRoleName: string | null;
  onShowThem: () => void;
};

/**
 * A hint above the list rather than a section of its own under it: a member with no role is
 * invisible in the roles list, so without this they are only found by going through every role
 * and noticing who is missing.
 */
export function UnassignedMembersHint({
  members,
  openRoleName,
  onShowThem,
}: UnassignedMembersHintProps) {
  if (members.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
      <UserX aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{members.length} without a role:</span>
      <span className="min-w-0 truncate">{nameList(members.map(fullName))}</span>
      {openRoleName ? (
        <button
          type="button"
          onClick={onShowThem}
          className="ml-auto shrink-0 rounded-md px-1 font-semibold underline-offset-2 hover:underline"
        >
          Show them in {openRoleName}
        </button>
      ) : (
        <span className="ml-auto shrink-0 text-app-text-muted">
          Open a role to give it to them.
        </span>
      )}
    </div>
  );
}
