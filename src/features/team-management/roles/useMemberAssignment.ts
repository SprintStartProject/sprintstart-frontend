import { useMemo, useState } from "react";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import {
  assignProjectRoleToUser,
  unassignProjectRoleFromUser,
} from "../../../services/teamManagementService";
import {
  applyChanges,
  assignmentChanges,
  type AssignmentChange,
  failedMemberNames,
  filterMembers,
  membersForAssignment,
  membersOfRole,
  nameList,
  type MemberFilter,
} from "../roleRules";
import type { TeamOverviewUser } from "../../../services/teamManagementTypes";

type Outcome = {
  done: AssignmentChange[];
  failed: AssignmentChange[];
  /** Why the first failed one failed. */
  reason: string;
};

/**
 * Settled, not all-or-nothing: the writes are independent, so one failing leaves the others done.
 * Treating that as a total failure kept the done ones as pending changes, and "Save" sent them a
 * second time.
 */
async function sendChanges(changes: AssignmentChange[], roleId: string): Promise<Outcome> {
  const results = await Promise.allSettled(
    changes.map(({ userId, add }) =>
      add ? assignProjectRoleToUser(userId, roleId) : unassignProjectRoleFromUser(userId, roleId),
    ),
  );
  const firstError = results.find((result) => result.status === "rejected");

  return {
    done: changes.filter((_, index) => results[index].status === "fulfilled"),
    failed: changes.filter((_, index) => results[index].status === "rejected"),
    reason: parseApiError(
      firstError?.status === "rejected" ? firstError.reason : null,
      "The request failed.",
    ),
  };
}

function reportOutcome(
  toast: ReturnType<typeof useToast>,
  { done, failed, reason }: Outcome,
  users: TeamOverviewUser[],
) {
  if (failed.length === 0) {
    toast.success("Members updated");
    return;
  }

  toast.error(`Couldn't update ${nameList(failedMemberNames(failed, users))}`, {
    description: done.length > 0 ? `${reason} The other changes were saved.` : reason,
  });
}

/** The search and the filter over the member list, holders of the role first. */
function useMemberSearch(users: TeamOverviewUser[], originalUserIds: string[]) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter | null>(null);
  const ordered = useMemo(
    () => membersForAssignment(users, originalUserIds),
    [originalUserIds, users],
  );
  const visibleMembers = useMemo(
    () => filterMembers(ordered, originalUserIds, query, filter),
    [filter, ordered, originalUserIds, query],
  );

  return {
    query,
    filter,
    setQuery,
    setFilter,
    visibleMembers,
    clear: () => {
      setQuery("");
      setFilter(null);
    },
  };
}

type Args = {
  users: TeamOverviewUser[];
  onDataChanged: () => Promise<void> | void;
};

/**
 * Who holds the open role. The member list starts pre-checked with its holders; confirming sends
 * only the added and removed ids, so a mis-click stays cancellable.
 */
export function useMemberAssignment({ users, onDataChanged }: Args) {
  const toast = useToast();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  // The snapshot taken when the role was opened, so confirming can send only the difference.
  const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const changes = assignmentChanges(selectedUserIds, originalUserIds);

  const search = useMemberSearch(users, originalUserIds);

  function startFor(roleId: string) {
    const assigned = membersOfRole(users, roleId).map((user) => user.userId);
    setSelectedUserIds(assigned);
    setOriginalUserIds(assigned);
    search.clear();
  }

  function clear() {
    setSelectedUserIds([]);
    setOriginalUserIds([]);
  }

  function toggle(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function save(roleId: string) {
    if (changes.length === 0 || saving) return;

    setSaving(true);
    const outcome = await sendChanges(changes, roleId);

    // What the backend now holds is the baseline; the failed ones stay as pending changes.
    setOriginalUserIds((current) => applyChanges(current, outcome.done));

    try {
      // Read back whatever went through, also when part of it failed.
      if (outcome.done.length > 0) await onDataChanged();
    } finally {
      setSaving(false);
    }

    reportOutcome(toast, outcome, users);
  }

  return {
    selectedUserIds,
    originalUserIds,
    visibleMembers: search.visibleMembers,
    saving,
    changeCount: changes.length,
    query: search.query,
    filter: search.filter,
    setQuery: search.setQuery,
    setFilter: search.setFilter,
    startFor,
    clear,
    toggle,
    reset: () => setSelectedUserIds(originalUserIds),
    save,
  };
}
