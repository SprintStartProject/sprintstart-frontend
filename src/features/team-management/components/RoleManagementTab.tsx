import { Check, Minus, Plus, Search, Sparkles, UserX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { SaveButton } from "../../../components/ui/SaveButton";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import type { FilterSelectOption } from "../../../components/ui/FilterSelect";
import { PmFilterChip, PmListToolbar } from "../../pm-area/components/PmListToolbar";
import { Checkbox } from "../../../components/ui/Checkbox";
import { NewRoleSkillsInput, type PendingSkill } from "./NewRoleSkillsInput";
import { RoleRow } from "./RoleRow";
import { SkillSuggestionPanel } from "./SkillSuggestionPanel";
import { skillSuggestionKey } from "../skillSuggestion";
import {
  acceptSkillSuggestion,
  assignProjectRoleToUser,
  createProjectRole,
  deleteProjectRole,
  getSkills,
  getSkillsByRoleId,
  unassignProjectRoleFromUser,
  updateRoleSkills,
} from "../../../services/teamManagementService";
import { parseApiError } from "../../../services/apiError";
import { useProjectContext } from "../../projects/useProjectContext";
import { useRoleSkillSuggestions } from "../useRoleSkillSuggestions";
import { isSkillLinkedToRole } from "../types";
import type { ProjectRole, Skill, SkillSuggestion, TeamOverviewUser } from "../types";

type RoleSort = "name" | "members" | "skills";

const ROLE_SORT_OPTIONS: FilterSelectOption<RoleSort>[] = [
  { value: "name", label: "Name" },
  { value: "members", label: "Most members" },
  { value: "skills", label: "Most skills" },
];

/** The roles worth a look: nobody holds them, or they carry no skills to assess. */
type RoleGapFilter = "no-members" | "no-skills";

/** Who the open role's member list narrows to; none chosen shows everyone, as on every list. */
type MemberFilter = "holds" | "without";

/** Names in a sentence: the first few, then a count. */
function nameList(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

type RoleManagementTabProps = {
  /** Roles of the current project, owned by the page so both tabs agree. */
  roles: ProjectRole[];
  /** Every member of the project, used for the assignment list. */
  users: TeamOverviewUser[];
  /**
   * Reloads members and roles from the server. Called after any change that
   * the members tab also has to see (role created/deleted, members assigned).
   */
  onDataChanged: () => Promise<void> | void;
};

/**
 * Full-page counterpart of the old hover-out rail: roles get their own tab
 * instead of a side panel, so creating a role, curating its skills and picking
 * who holds it all happen in one place.
 *
 * Selection is diff-based rather than one request per click: the member list
 * starts pre-checked with whoever already holds the role, and confirming only
 * sends the added and removed ids. That keeps a mis-click cancellable and
 * avoids writing to the server while the user is still deciding.
 */
export function RoleManagementTab({ roles, users, onDataChanged }: RoleManagementTabProps) {
  const prefersReducedMotion = useReducedMotion();

  const expandTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const },
    [prefersReducedMotion],
  );

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const toast = useToast();
  const { profile } = useAuth();
  const { selectedProjectId, selectedProject, hasSelectedProject } = useProjectContext();
  const { isSuggesting, suggest } = useRoleSkillSuggestions();

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  const [skillName, setSkillName] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);

  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [removingSkillId, setRemovingSkillId] = useState<string | null>(null);
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestion[]>([]);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  // Ids ticked in the member list, and the snapshot taken when the role was
  // opened so confirming can send only the difference.
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // The list's toolbar, the same one the team, the questions and the gaps have.
  const [roleQuery, setRoleQuery] = useState("");
  const [roleSort, setRoleSort] = useState<RoleSort>("name");
  const [roleGapFilter, setRoleGapFilter] = useState<RoleGapFilter | null>(null);
  // Creating is a button in the toolbar that opens the form at the top of the list, rather than a
  // column of its own beside it: the list gets the full width, like every other list here.
  const [showCreate, setShowCreate] = useState(false);
  // Skills picked in the create form, added the moment the role exists, and whether the AI is
  // asked for more on top.
  const [newRoleSkills, setNewRoleSkills] = useState<PendingSkill[]>([]);
  const [suggestOnCreate, setSuggestOnCreate] = useState(true);
  // Opening the form puts the cursor in its first field, so "New role" is one press to typing.
  const newRoleNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (showCreate) newRoleNameRef.current?.focus();
  }, [showCreate]);
  // The open role's member list: a search and who to show.
  const [memberQuery, setMemberQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter | null>(null);

  useEffect(() => {
    async function loadSkills() {
      setSkills(await getSkills());
    }

    void loadSkills();
  }, []);

  // Resolved from the roles prop rather than stored, so a role that
  // disappears from the list simply collapses the detail pane instead of
  // leaving a dangling id behind.
  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const detailRef = useRef<HTMLDivElement>(null);

  // Mirrors `selectedRoleId`, but as a ref rather than state: a suggestion
  // request or an apply that is still in flight when the user switches (or
  // closes) roles reads this *after* awaiting, to tell whether its result is
  // still meant for the role that is open by the time it arrives. State read
  // through the async function's closure would only ever see the value from
  // when the request started, not the live selection.
  const selectedRoleIdRef = useRef<string | null>(null);

  /**
   * Brings the opened role into view once it has finished expanding.
   *
   * Waiting for the animation matters: while it runs the panel is still
   * growing, so scrolling to it early aims at a box that is not its final
   * size yet. `block: "nearest"` keeps it to the smallest scroll that works
   * -- if the panel is already visible nothing moves at all.
   */
  const scrollDetailIntoView = useCallback(() => {
    detailRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [prefersReducedMotion]);

  function openRole(roleId: string) {
    if (selectedRoleId === roleId) {
      closeRole();
      return;
    }

    const assignedUserIds = users
      .filter((user) => user.roles.some((role) => role.id === roleId))
      .map((user) => user.userId);

    setShowSuggestionPanel(false);
    setSkillSuggestions([]);
    setSelectedSuggestionKeys(new Set());
    setSuggestionError(null);
    selectedRoleIdRef.current = roleId;
    setSelectedRoleId(roleId);
    setSelectedUserIds(assignedUserIds);
    setOriginalUserIds(assignedUserIds);
    setSkillName("");
    setMemberQuery("");
    setMemberFilter(null);
  }

  function closeRole() {
    selectedRoleIdRef.current = null;
    setSelectedRoleId(null);
    setShowSuggestionPanel(false);
    setSkillSuggestions([]);
    setSelectedSuggestionKeys(new Set());
    setSuggestionError(null);
    setSelectedUserIds([]);
    setOriginalUserIds([]);
    setSkillName("");
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  const userIdsToAdd = selectedUserIds.filter((id) => !originalUserIds.includes(id));
  const userIdsToRemove = originalUserIds.filter((id) => !selectedUserIds.includes(id));
  // Additions and removals both count: the button saves one batch, and
  // "3 changes" is the honest size of what confirming is about to send.
  const assignChangeCount = userIdsToAdd.length + userIdsToRemove.length;
  const hasAssignChanges = assignChangeCount > 0;

  async function handleCreateRole() {
    if (!roleName.trim() || creatingRole) return;

    setCreatingRole(true);

    try {
      const newRole = await createProjectRole(roleName.trim(), roleDescription.trim());

      // The skills picked in the form, one after another: each answer is the role's whole
      // skill list, so the last one that worked is the list to show. One that fails does not
      // undo the role or the others; it is named afterwards so it can be added in the panel.
      let roleSkills: Skill[] | null = null;
      const failedSkills: string[] = [];
      for (const pending of newRoleSkills) {
        try {
          roleSkills = await acceptSkillSuggestion(
            newRole.id,
            pending.skillId ? { skillId: pending.skillId } : { name: pending.name },
          );
        } catch {
          failedSkills.push(pending.name);
        }
      }
      if (roleSkills) replaceRoleSkills(newRole.id, roleSkills);

      const addedCount = newRoleSkills.length - failedSkills.length;
      setRoleName("");
      setRoleDescription("");
      setNewRoleSkills([]);
      setShowCreate(false);
      await onDataChanged();
      openRole(newRole.id);
      toast.success(
        addedCount > 0
          ? `Role created with ${addedCount} ${addedCount === 1 ? "skill" : "skills"}`
          : "Role created",
      );
      if (failedSkills.length > 0) {
        toast.error(`Couldn't add ${failedSkills.join(", ")}. Add it in the role's panel.`);
      }

      // HR can create roles but the suggest endpoint is ADMIN/PM-only; firing
      // it for HR would 403 and show an unrecoverable error in the panel with
      // no button to dismiss it. Not awaited: the AI round-trip should not
      // keep the create button (and its "Creating role…" label) busy once the
      // role already exists and is open -- the panel has its own spinner.
      if (canSuggestSkills && suggestOnCreate) {
        void requestSkillSuggestions(newRole.id);
      }
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't create the role."));
    } finally {
      setCreatingRole(false);
    }
  }
  async function confirmDeleteRole() {
    if (!deleteRoleId) return;

    const roleId = deleteRoleId;
    setDeleteRoleId(null);

    try {
      await deleteProjectRole(roleId);

      setSkills((current) =>
        current.map((skill) => ({
          ...skill,
          roleIds: skill.roleIds.filter((id) => id !== roleId),
        })),
      );

      if (selectedRoleId === roleId) {
        closeRole();
      }

      await onDataChanged();
      toast.success("Role deleted");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't delete the role."));
    }
  }

  async function handleAddSkill() {
    if (!selectedRole || !skillName.trim() || addingSkill) return;

    setAddingSkill(true);

    try {
      const roleSkills = await acceptSkillSuggestion(selectedRole.id, {
        name: skillName.trim(),
      });

      replaceRoleSkills(selectedRole.id, roleSkills);
      setSkillName("");
      toast.success("Skill added");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't add the skill."));
    } finally {
      setAddingSkill(false);
    }
  }
  /**
   * Unlinks a skill from the open role, without retiring it globally.
   *
   * `updateRoleSkills` replaces the role's complete skill list, so the request carries
   * every skill currently linked to this role minus the one being removed -- including
   * retired ones, which stay linked even though they can no longer be picked here.
   * Disabled from the caller when the skill would be left with no role at all, since the
   * backend rejects that with a 400; the `parseApiError` toast is a safety net for a
   * race (another tab removing the skill's last other role first), not the primary guard.
   */
  async function handleRemoveSkillFromRole(skill: Skill) {
    if (!selectedRole || removingSkillId) return;

    const remainingSkillIds = selectedRoleSkills
      .filter((candidate) => candidate.id !== skill.id)
      .map((candidate) => candidate.id);

    setRemovingSkillId(skill.id);

    try {
      const roleSkills = await updateRoleSkills(selectedRole.id, remainingSkillIds);

      replaceRoleSkills(selectedRole.id, roleSkills);
      toast.success("Skill removed from role");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't remove the skill from this role."));
    } finally {
      setRemovingSkillId(null);
    }
  }

  async function handleSaveAssignment() {
    if (!selectedRole || !hasAssignChanges || savingAssignment) return;

    const roleId = selectedRole.id;
    setSavingAssignment(true);

    // Settled, not all-or-nothing: the writes are independent, so one failing leaves the others
    // done. Treating that as a total failure kept the done ones as pending changes, and "Save"
    // sent them a second time.
    const changes = [
      ...userIdsToAdd.map((userId) => ({ userId, add: true })),
      ...userIdsToRemove.map((userId) => ({ userId, add: false })),
    ];
    const results = await Promise.allSettled(
      changes.map(({ userId, add }) =>
        add ? assignProjectRoleToUser(userId, roleId) : unassignProjectRoleFromUser(userId, roleId),
      ),
    );
    const done = changes.filter((_, index) => results[index].status === "fulfilled");
    const failed = changes.filter((_, index) => results[index].status === "rejected");

    // What the backend now holds is the baseline; the failed ones stay as pending changes.
    setOriginalUserIds((current) => {
      const held = new Set(current);
      done.forEach(({ userId, add }) => (add ? held.add(userId) : held.delete(userId)));
      return [...held];
    });

    try {
      // Read back whatever went through, also when part of it failed.
      if (done.length > 0) await onDataChanged();
    } finally {
      setSavingAssignment(false);
    }

    if (failed.length === 0) {
      toast.success("Members updated");
      return;
    }

    const firstError = results.find((result) => result.status === "rejected");
    const names = failed.map(({ userId }) => {
      const user = users.find((candidate) => candidate.userId === userId);
      return user ? `${user.firstname} ${user.lastname}`.trim() : "a member";
    });
    const reason = parseApiError(
      firstError?.status === "rejected" ? firstError.reason : null,
      "The request failed.",
    );
    toast.error(`Couldn't update ${nameList(names)}`, {
      description: done.length > 0 ? `${reason} The other changes were saved.` : reason,
    });
  }

  function handleResetAssignment() {
    setSelectedUserIds(originalUserIds);
  }

  /** Active skills first, then retired, each group alphabetical. */
  const getRoleSkills = useCallback(
    (roleId: string) =>
      skills
        .filter((skill) => isSkillLinkedToRole(skill, roleId))
        .sort((first, second) =>
          first.status === second.status
            ? first.name.localeCompare(second.name)
            : first.status === "ACTIVE"
              ? -1
              : 1,
        ),
    [skills],
  );

  const selectedRoleSkills = selectedRole ? getRoleSkills(selectedRole.id) : [];
  const canSuggestSkills =
    profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  function replaceRoleSkills(roleId: string, roleSkills: Skill[]) {
    const responseById = new Map(roleSkills.map((skill) => [skill.id, skill]));

    setSkills((current) => {
      const merged = current.map((skill) => {
        const updated = responseById.get(skill.id);
        if (updated) return updated;

        return isSkillLinkedToRole(skill, roleId)
          ? { ...skill, roleIds: skill.roleIds.filter((id) => id !== roleId) }
          : skill;
      });
      const knownIds = new Set(current.map(({ id }) => id));

      return [...merged, ...roleSkills.filter((skill) => !knownIds.has(skill.id))];
    });
  }

  async function requestSkillSuggestions(roleId: string) {
    setShowSuggestionPanel(true);
    setSuggestionError(null);
    setSkillSuggestions([]);
    setSelectedSuggestionKeys(new Set());

    const context = hasSelectedProject
      ? {
          projectId: selectedProjectId,
          ...(selectedProject?.industry ? { industry: selectedProject.industry } : {}),
        }
      : undefined;
    const result = await suggest(roleId, context);

    // The user may have closed this role or opened another one while the
    // request was in flight; a late answer must not overwrite whatever that
    // other role's panel is showing (or apply itself to the wrong role once
    // "Apply" is pressed).
    if (selectedRoleIdRef.current !== roleId) return;

    if (!result.ok) {
      setSuggestionError(result.message);
      return;
    }

    const uniqueSuggestions = Array.from(
      new Map(result.suggestions.map((item) => [skillSuggestionKey(item), item])).values(),
    );

    setSkillSuggestions(uniqueSuggestions);
    setSelectedSuggestionKeys(new Set(uniqueSuggestions.map(skillSuggestionKey)));
  }

  function toggleSuggestion(key: string) {
    setSelectedSuggestionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApplySuggestions() {
    if (!selectedRole || applyingSuggestions) return;

    const roleId = selectedRole.id;
    const currentIds = new Set(selectedRoleSkills.map(({ id }) => id));
    const currentNames = new Set(
      selectedRoleSkills.map(({ name }) => name.trim().toLocaleLowerCase()),
    );
    const accepted = skillSuggestions.filter(
      (suggestion) =>
        selectedSuggestionKeys.has(skillSuggestionKey(suggestion)) &&
        !(suggestion.skillId && currentIds.has(suggestion.skillId)) &&
        !currentNames.has(suggestion.name.trim().toLocaleLowerCase()),
    );

    if (accepted.length === 0) return;

    setApplyingSuggestions(true);
    setSuggestionError(null);

    try {
      let roleSkills = selectedRoleSkills;

      for (const suggestion of accepted) {
        roleSkills = await acceptSkillSuggestion(
          roleId,
          suggestion.skillId
            ? { skillId: suggestion.skillId }
            : { name: suggestion.name, category: suggestion.category },
        );
      }

      replaceRoleSkills(roleId, roleSkills);

      // Closing/reopening onto another role while this ran must not
      // suddenly hide *that* role's panel or wipe its own suggestions;
      // only touch the shared panel state if this role is still the one
      // open.
      if (selectedRoleIdRef.current === roleId) {
        setShowSuggestionPanel(false);
        setSkillSuggestions([]);
        setSelectedSuggestionKeys(new Set());
      }

      toast.success(
        accepted.length === 1
          ? "1 suggested skill added"
          : `${accepted.length} suggested skills added`,
      );
    } catch (error) {
      try {
        replaceRoleSkills(roleId, await getSkillsByRoleId(roleId));
      } catch {
        // The original apply error is the actionable one; a refresh failure must not hide it.
      }

      if (selectedRoleIdRef.current === roleId) {
        setSuggestionError(
          parseApiError(
            error,
            "Some suggestions may have been added. Review the role skills and try again.",
          ),
        );
      }
    } finally {
      setApplyingSuggestions(false);
    }
  }
  const getRoleMembers = useCallback(
    (roleId: string) =>
      users.filter((user) => user.roles.some((userRole) => userRole.id === roleId)),
    [users],
  );

  /**
   * Everyone, with the current holders first.
   *
   * Ordered by the snapshot taken when the role was opened, not by the live
   * ticks: sorting on the live selection would make a card jump to the top
   * the moment it is ticked, moving the rows under the cursor mid-click.
   * `sort` is stable, so within each group the original order survives.
   */
  const membersForAssignment = useMemo(() => {
    const heldOriginally = new Set(originalUserIds);

    return [...users].sort(
      (first, second) =>
        (heldOriginally.has(first.userId) ? 0 : 1) - (heldOriginally.has(second.userId) ? 0 : 1),
    );
  }, [originalUserIds, users]);

  // Worth surfacing on the overview: a member with no role is invisible in
  // the roles list, so without this they are only found by going through
  // every role and noticing who is missing.
  const usersWithoutRole = users.filter((user) => user.roles.length === 0);

  const rolesWithoutMembers = roles.filter((role) => getRoleMembers(role.id).length === 0).length;
  const rolesWithoutSkills = roles.filter((role) => getRoleSkills(role.id).length === 0).length;

  /**
   * The roles the toolbar leaves: searched by name, description, skill or member, narrowed to a
   * gap, and sorted. The open role always stays, so narrowing never closes what is being worked
   * on.
   */
  const visibleRoles = useMemo(() => {
    const query = roleQuery.trim().toLowerCase();
    const matches = roles.filter((role) => {
      if (role.id === selectedRoleId) return true;
      const roleMembers = getRoleMembers(role.id);
      const roleSkills = getRoleSkills(role.id);
      if (roleGapFilter === "no-members" && roleMembers.length > 0) return false;
      if (roleGapFilter === "no-skills" && roleSkills.length > 0) return false;
      if (query === "") return true;
      return [
        role.name,
        role.description ?? "",
        ...roleSkills.map((skill) => skill.name),
        ...roleMembers.map((member) => `${member.firstname} ${member.lastname}`),
      ].some((text) => text.toLowerCase().includes(query));
    });

    return [...matches].sort((first, second) => {
      if (roleSort === "members") {
        const diff = getRoleMembers(second.id).length - getRoleMembers(first.id).length;
        if (diff !== 0) return diff;
      }
      if (roleSort === "skills") {
        const diff = getRoleSkills(second.id).length - getRoleSkills(first.id).length;
        if (diff !== 0) return diff;
      }
      return first.name.localeCompare(second.name);
    });
  }, [getRoleMembers, getRoleSkills, roleGapFilter, roleQuery, roleSort, roles, selectedRoleId]);

  const listNarrowed = roleQuery.trim() !== "" || roleGapFilter !== null || roleSort !== "name";

  /** The open role's member list after its search and filter. */
  const visibleMembers = useMemo(() => {
    const heldOriginally = new Set(originalUserIds);
    const query = memberQuery.trim().toLowerCase();
    return membersForAssignment.filter((user) => {
      if (memberFilter === "holds" && !heldOriginally.has(user.userId)) return false;
      if (memberFilter === "without" && user.roles.length > 0) return false;
      if (query === "") return true;
      return `${user.firstname} ${user.lastname}`.toLowerCase().includes(query);
    });
  }, [memberFilter, memberQuery, membersForAssignment, originalUserIds]);

  // What deleting the role would take away, for the confirmation to say before it happens.
  const deleteImpact = deleteRoleId
    ? {
        members: getRoleMembers(deleteRoleId).map((user) => `${user.firstname} ${user.lastname}`),
        skills: getRoleSkills(deleteRoleId).length,
      }
    : null;

  const roleToDelete = roles.find((role) => role.id === deleteRoleId);

  // The open role, expanded right under its row in the list. Everything about it lives in here --
  // who holds it, and which skills it carries -- so working on a role never means looking at two
  // places at once.
  const roleDetail = selectedRole ? (
    <section className="rounded-xl border border-app-border-muted bg-app-bg/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* The row right above already names the role and says what it does; the heading
              stays for screen readers, who meet the panel without the row beside it. */}
          <p className="text-sm font-semibold text-app-brand">Manage role</p>
          <h3 className="sr-only">{selectedRole.name}</h3>
        </div>

        <button
          type="button"
          onClick={closeRole}
          aria-label="Close role details"
          className="shrink-0 rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Members take the room, skills sit in a narrow column beside them: the member list is
          the part that grows with the team, the skill list stays short. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-app-text">Members</h4>
          <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
            Ticked members hold {selectedRole.name}. Untick to take it away —{" "}
            {selectedUserIds.length} selected.
          </p>

          {/* Search and narrow the people, for a team too large to scan. */}
          {/* Search on a line of its own, the filters under it: side by side they were squeezed
              into the members column. */}
          <div className="mt-4 space-y-2">
            <div className="min-w-0">
              <Input
                size="sm"
                icon={<Search className="h-4 w-4" />}
                aria-label="Search members"
                placeholder="Search members…"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
              />
            </div>
            <div role="group" aria-label="Show members" className="flex flex-wrap gap-2">
              {/* Pressing the chosen one again lets go of it, back to everyone. */}
              <PmFilterChip
                active={memberFilter === "holds"}
                onClick={() => setMemberFilter((current) => (current === "holds" ? null : "holds"))}
                label="Has this role"
                count={originalUserIds.length}
              />
              <PmFilterChip
                active={memberFilter === "without"}
                onClick={() =>
                  setMemberFilter((current) => (current === "without" ? null : "without"))
                }
                label="Without a role"
                count={usersWithoutRole.length}
                flagged
              />
            </div>
          </div>

          {/* A list like every other in the area, one row per person: tick to give the role,
              untick to take it away. */}
          <ul className="mt-3 divide-y divide-app-border-muted overflow-hidden rounded-xl border border-app-border bg-app-surface">
            {visibleMembers.map((user) => {
              const isChecked = selectedUserIds.includes(user.userId);
              const heldBefore = originalUserIds.includes(user.userId);
              // The two pending states,
              // shown in the colour of
              // the action they will
              // perform on save.
              const isBeingAdded = isChecked && !heldBefore;
              const isBeingRemoved = !isChecked && heldBefore;
              const fullName = `${user.firstname} ${user.lastname}`;

              const progress = Math.round((user.progressPercentage ?? 0) * 100);

              return (
                <li key={user.userId}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                      isBeingAdded
                        ? "bg-app-success-bg"
                        : isBeingRemoved
                          ? "bg-app-danger-bg"
                          : isChecked
                            ? "bg-app-brand-soft/60 hover:bg-app-brand-soft"
                            : "hover:bg-app-surface-hover"
                    }`}
                  >
                    {/* The real control, kept for
                                                                keyboard and screen readers;
                                                                the box beside it is what is
                                                                actually seen, because a
                                                                native checkbox cannot show
                                                                three different marks. */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={savingAssignment}
                      onChange={() => toggleUser(user.userId)}
                      className="peer sr-only"
                    />

                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-focus peer-focus-visible:outline-solid ${
                        isBeingAdded
                          ? "border-app-success-border bg-app-success-bg text-app-success-text"
                          : isBeingRemoved
                            ? "border-app-danger-border bg-app-danger-bg text-app-danger-text"
                            : isChecked
                              ? "border-app-brand bg-app-brand text-app-text-inverse"
                              : "border-app-border bg-app-surface"
                      }`}
                    >
                      {isBeingAdded ? (
                        <Plus className="h-3.5 w-3.5" />
                      ) : isBeingRemoved ? (
                        <Minus className="h-3.5 w-3.5" />
                      ) : isChecked ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                    </span>

                    <UserAvatar
                      profileIcon={user.profileIcon}
                      fallbackName={fullName}
                      seed={user.userId}
                      size={32}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-app-text">
                        {fullName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-app-text-muted">
                        {user.roles.length === 0
                          ? "No roles"
                          : user.roles.map((role) => role.name).join(", ")}
                      </span>
                    </span>

                    {/* Where they are in onboarding — who is being given the role, not only
                      their name. */}
                    <span className="hidden w-32 shrink-0 text-right text-xs text-app-text-muted sm:block">
                      <span className="block truncate">
                        {user.currentPhase?.title ?? "Not started"}
                      </span>
                      <span className="block tabular-nums">{progress}% through</span>
                    </span>

                    {(isBeingAdded || isBeingRemoved) && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isBeingAdded
                            ? "bg-app-success-solid/15 text-app-success-text"
                            : "bg-app-danger-solid/15 text-app-danger-text"
                        }`}
                      >
                        {isBeingAdded ? "Will be added" : "Will be removed"}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}

            {users.length === 0 ? (
              <li className="px-3 py-3 text-xs text-app-text-muted">
                No members in this project yet.
              </li>
            ) : (
              visibleMembers.length === 0 && (
                <li className="px-3 py-3 text-xs text-app-text-muted">Nobody matches.</li>
              )
            )}
          </ul>

          {/* Below the list, not above it: the buttons
                                    act on choices made in the list, so they
                                    should be where the eye ends up rather than
                                    where it started. */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleResetAssignment}
              disabled={!hasAssignChanges || savingAssignment}
              className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>

            <SaveButton
              dirty={hasAssignChanges}
              saving={savingAssignment}
              onClick={() => void handleSaveAssignment()}
              label={`Save ${assignChangeCount} ${assignChangeCount === 1 ? "change" : "changes"}`}
            />
          </div>
        </div>

        <div className="min-w-0 border-t border-app-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-app-text">Skills</h4>
            {canSuggestSkills && (
              <Button
                variant="secondary"
                size="sm"
                data-testid="suggest-skills-button"
                loading={isSuggesting === selectedRole.id}
                disabled={applyingSuggestions}
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => void requestSkillSuggestions(selectedRole.id)}
              >
                {showSuggestionPanel ? "Refresh suggestions" : "Suggest skills"}
              </Button>
            )}
          </div>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-app-text-muted">
            Skills of this role, shown in the skill assessment flow for assigned members.
          </p>

          <div className="flex flex-wrap gap-2">
            {selectedRoleSkills.map((skill) => (
              <span
                key={skill.id}
                aria-label={skill.name}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                  skill.status === "RETIRED"
                    ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
                    : "border-app-border bg-app-bg text-app-text"
                }`}
              >
                {skill.name}
                {skill.status === "RETIRED" ? (
                  <span className="font-medium">Retired</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${skill.name} from role`}
                    title={
                      skill.roleIds.length === 1
                        ? "Only role of this skill. An admin can retire it in Access Management."
                        : undefined
                    }
                    disabled={skill.roleIds.length === 1 || removingSkillId === skill.id}
                    onClick={() => void handleRemoveSkillFromRole(skill)}
                    className="text-app-text-muted transition-colors hover:text-app-danger-text disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-app-text-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}

            {selectedRoleSkills.length === 0 && (
              <p className="text-xs text-app-text-muted">No skills added yet.</p>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <label htmlFor="new-skill-name" className="sr-only">
              Add skill to {selectedRole.name}
            </label>
            <Input
              id="new-skill-name"
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="Add skill, e.g. React"
            />

            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={() => void handleAddSkill()}
                disabled={!skillName.trim()}
                loading={addingSkill}
              >
                {addingSkill ? "Adding..." : "Add skill"}
              </Button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {showSuggestionPanel && (
              <SkillSuggestionPanel
                currentSkills={selectedRoleSkills}
                suggestions={skillSuggestions}
                selectedKeys={selectedSuggestionKeys}
                isLoading={isSuggesting === selectedRole.id}
                isApplying={applyingSuggestions}
                errorMessage={suggestionError}
                onToggle={toggleSuggestion}
                onApply={() => void handleApplySuggestions()}
                onRetry={() => void requestSkillSuggestions(selectedRole.id)}
                onClose={() => setShowSuggestionPanel(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  ) : null;

  return (
    <>
      <div className="min-w-0">
        <PmListToolbar<RoleSort>
          search={{
            label: "Search roles",
            placeholder: "Search by role, skill or member…",
            value: roleQuery,
            onChange: setRoleQuery,
          }}
          filtersLabel="Filter roles"
          filters={
            <>
              <PmFilterChip
                active={roleGapFilter === "no-members"}
                onClick={() =>
                  setRoleGapFilter((current) => (current === "no-members" ? null : "no-members"))
                }
                label="No members"
                count={rolesWithoutMembers}
                flagged
              />
              <PmFilterChip
                active={roleGapFilter === "no-skills"}
                onClick={() =>
                  setRoleGapFilter((current) => (current === "no-skills" ? null : "no-skills"))
                }
                label="No skills"
                count={rolesWithoutSkills}
                flagged
              />
            </>
          }
          shown={visibleRoles.length}
          total={roles.length}
          onReset={
            listNarrowed
              ? () => {
                  setRoleQuery("");
                  setRoleGapFilter(null);
                  setRoleSort("name");
                }
              : undefined
          }
          extra={
            <Button
              variant="primary"
              size="sm"
              icon={showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowCreate((open) => !open)}
              aria-expanded={showCreate}
            >
              {showCreate ? "Cancel" : "New role"}
            </Button>
          }
          sort={{
            label: "Sort roles",
            value: roleSort,
            options: ROLE_SORT_OPTIONS,
            onChange: setRoleSort,
          }}
        />

        {/* Members nobody has given a role yet: a hint above the list rather than a section of
            its own under it. With a role open, one press shows them in its member list. */}
        {usersWithoutRole.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-2 text-xs text-app-warning-text">
            <UserX aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">{usersWithoutRole.length} without a role:</span>
            <span className="min-w-0 truncate">
              {nameList(usersWithoutRole.map((user) => `${user.firstname} ${user.lastname}`))}
            </span>
            {selectedRole ? (
              <button
                type="button"
                onClick={() => setMemberFilter("without")}
                className="ml-auto shrink-0 rounded-md px-1 font-semibold underline-offset-2 hover:underline"
              >
                Show them in {selectedRole.name}
              </button>
            ) : (
              <span className="ml-auto shrink-0 text-app-text-muted">
                Open a role to give it to them.
              </span>
            )}
          </div>
        )}

        {/* One list, like the team, the questions and the gaps: a row per role, and the open
            role's panel expanded right under its row. */}
        {/* The new role's form, a card of its own above the list rather than its first row, so it
            stands apart from the roles already there. */}
        <AnimatePresence initial={false}>
          {showCreate && (
            <motion.section
              key="create-role"
              aria-label="New role"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={expandTransition}
              className="overflow-hidden"
            >
              {/* Set apart from the rows under it — tinted, framed in the brand colour, with a
                      heading of its own — so it reads as the thing to fill in now. */}
              <div className="mt-3 rounded-2xl border border-app-brand-border-strong bg-app-brand-soft/60 shadow-md ring-1 ring-app-brand/20">
                <div className="flex items-start gap-3 px-4 pt-4">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-app-text">New role</h4>
                    <p className="text-xs text-app-text-muted">
                      Name it, say what it is for and pick its skills — members can be given it
                      right after.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-start">
                  <div>
                    <label
                      htmlFor="new-role-name"
                      className="mb-1 block text-xs font-medium text-app-text-muted"
                    >
                      Name
                    </label>
                    <Input
                      ref={newRoleNameRef}
                      id="new-role-name"
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                      placeholder="e.g. Backend"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-role-description"
                      className="mb-1 block text-xs font-medium text-app-text-muted"
                    >
                      Description
                    </label>
                    <Textarea
                      id="new-role-description"
                      value={roleDescription}
                      onChange={(event) => setRoleDescription(event.target.value)}
                      minRows={1}
                      maxRows={6}
                      placeholder="What this role is responsible for"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <NewRoleSkillsInput
                      catalog={skills}
                      value={newRoleSkills}
                      onChange={setNewRoleSkills}
                      disabled={creatingRole}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                    {canSuggestSkills ? (
                      <label
                        htmlFor="new-role-suggest"
                        className="flex cursor-pointer items-center gap-2 text-xs text-app-text-muted"
                      >
                        <Checkbox
                          id="new-role-suggest"
                          checked={suggestOnCreate}
                          onChange={(event) => setSuggestOnCreate(event.target.checked)}
                        />
                        Also suggest skills with AI — to review once the role is open
                      </label>
                    ) : (
                      <p className="text-xs text-app-text-muted">
                        The role opens right away to assign members.
                      </p>
                    )}
                    <Button
                      variant="primary"
                      onClick={() => void handleCreateRole()}
                      disabled={!roleName.trim()}
                      loading={creatingRole}
                      icon={<Plus className="h-4 w-4" />}
                    >
                      {creatingRole ? "Creating role…" : "Create role"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {roles.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            {visibleRoles.length > 0 ? (
              <ul className="divide-y divide-app-border-muted px-3 py-1.5">
                {visibleRoles.map((role) => {
                  const open = selectedRoleId === role.id;
                  return (
                    <li key={role.id} className="py-0.5">
                      <RoleRow
                        role={role}
                        skills={getRoleSkills(role.id)}
                        members={getRoleMembers(role.id)}
                        selected={open}
                        onSelect={openRole}
                        onRequestDelete={setDeleteRoleId}
                      />
                      <AnimatePresence initial={false}>
                        {open && roleDetail && (
                          // Height on the wrapper, padding inside: a padded element cannot
                          // animate to zero height, it stops at its own padding.
                          <motion.div
                            key="role-detail"
                            ref={detailRef}
                            onAnimationComplete={() => {
                              // Also fires for the exit, when there is nothing to scroll to.
                              if (selectedRoleIdRef.current === role.id) scrollDetailIntoView();
                            }}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={expandTransition}
                            className="min-w-0 overflow-hidden"
                          >
                            <div className="px-1 pt-1 pb-3">{roleDetail}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            ) : (
              roles.length > 0 && (
                <p className="p-6 text-center text-sm text-app-text-muted">
                  No roles match these filters.
                </p>
              )
            )}
          </div>
        )}

        {roles.length === 0 && !showCreate && (
          <p className="mt-3 text-xs text-app-text-muted">
            No roles yet. Create the first one with “New role”.
          </p>
        )}
      </div>

      <AlertDialog
        isOpen={Boolean(deleteRoleId)}
        title="Confirm deletion"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium text-app-text">{roleToDelete?.name ?? "this item"}</span>?
            {deleteImpact && deleteImpact.members.length > 0 && (
              <>
                {" "}
                {deleteImpact.members.length === 1
                  ? "1 member loses"
                  : `${deleteImpact.members.length} members lose`}{" "}
                this role: {nameList(deleteImpact.members)}.
              </>
            )}
            {deleteImpact && deleteImpact.skills > 0 && (
              <>
                {" "}
                {deleteImpact.skills === 1
                  ? "Its 1 skill stays"
                  : `Its ${deleteImpact.skills} skills stay`}{" "}
                in the catalog, no longer linked to the role.
              </>
            )}{" "}
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteRoleId(null)}
        onConfirm={() => void confirmDeleteRole()}
      />
    </>
  );
}
