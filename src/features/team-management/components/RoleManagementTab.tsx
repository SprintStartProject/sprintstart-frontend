import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { deleteProjectRole } from "../../../services/teamManagementService";
import {
  fullName,
  filterAndSortRoles,
  isListNarrowed,
  membersOfRole,
  skillsOfRole,
  type RoleGapFilter,
  type RoleSort,
} from "../roleRules";
import { useExpandTransition } from "../roles/useExpandTransition";
import { useMemberAssignment } from "../roles/useMemberAssignment";
import { useRoleCreation } from "../roles/useRoleCreation";
import { useRoleSkillEdits } from "../roles/useRoleSkillEdits";
import { useSkillCatalog } from "../roles/useSkillCatalog";
import { useSuggestionFlow } from "../roles/useSuggestionFlow";
import type { ProjectRole, TeamOverviewUser } from "../types";
import { CreateRoleForm } from "./CreateRoleForm";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { MemberAssignmentList } from "./MemberAssignmentList";
import { RoleDetail } from "./RoleDetail";
import { RoleList } from "./RoleList";
import { RoleListToolbar } from "./RoleListToolbar";
import { RoleSkillsPanel } from "./RoleSkillsPanel";
import { UnassignedMembersHint } from "./UnassignedMembersHint";

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
  const { transition } = useExpandTransition();
  const toast = useToast();
  const { profile } = useAuth();
  const canSuggest = profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  const { skills, replaceRoleSkills, forgetRole } = useSkillCatalog();
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [roleQuery, setRoleQuery] = useState("");
  const [roleSort, setRoleSort] = useState<RoleSort>("name");
  const [roleGap, setRoleGap] = useState<RoleGapFilter | null>(null);
  // Resolved from the roles prop rather than stored, so a role that disappears from the list
  // simply collapses the detail pane instead of leaving a dangling id behind.
  const openRole = useMemo(
    () => roles.find((role) => role.id === openRoleId) ?? null,
    [roles, openRoleId],
  );
  const openRoleSkills = useMemo(
    () => (openRole ? skillsOfRole(skills, openRole.id) : []),
    [openRole, skills],
  );
  const openRoleIdRef = useRef<string | null>(null);

  const assignment = useMemberAssignment({ users, onDataChanged });
  const suggestions = useSuggestionFlow({
    openRoleIdRef,
    roleSkills: openRoleSkills,
    replaceRoleSkills,
  });
  const skillEdits = useRoleSkillEdits({
    roleId: openRole?.id ?? null,
    roleSkills: openRoleSkills,
    replaceRoleSkills,
  });

  function open(roleId: string) {
    if (openRoleId === roleId) {
      close();
      return;
    }

    suggestions.reset();
    openRoleIdRef.current = roleId;
    setOpenRoleId(roleId);
    assignment.startFor(roleId);
    skillEdits.setSkillName("");
  }

  function close() {
    openRoleIdRef.current = null;
    setOpenRoleId(null);
    suggestions.reset();
    assignment.clear();
    skillEdits.setSkillName("");
  }

  const creation = useRoleCreation({
    canSuggest,
    replaceRoleSkills,
    onDataChanged,
    openRole: open,
    suggestFor: suggestions.request,
  });

  async function confirmDeleteRole() {
    if (!deleteRoleId) return;

    const roleId = deleteRoleId;
    setDeleteRoleId(null);

    try {
      await deleteProjectRole(roleId);
      forgetRole(roleId);
      if (openRoleId === roleId) close();

      await onDataChanged();
      toast.success("Role deleted");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't delete the role."));
    }
  }

  const query = { query: roleQuery, gap: roleGap, sort: roleSort, openRoleId };
  const visibleRoles = filterAndSortRoles(roles, skills, users, query);
  const skillsOf = (roleId: string) => skillsOfRole(skills, roleId);
  const membersOf = (roleId: string) => membersOfRole(users, roleId);
  const usersWithoutRole = users.filter((user) => user.roles.length === 0);
  const roleToDelete = roles.find((role) => role.id === deleteRoleId);
  const deleteImpact = deleteRoleId
    ? { members: membersOf(deleteRoleId).map(fullName), skills: skillsOf(deleteRoleId).length }
    : null;

  const detail = openRole ? (
    <RoleDetail
      roleName={openRole.name}
      onClose={close}
      members={
        <MemberAssignmentList
          roleName={openRole.name}
          visibleMembers={assignment.visibleMembers}
          totalMembers={users.length}
          selectedUserIds={assignment.selectedUserIds}
          originalUserIds={assignment.originalUserIds}
          withoutRoleCount={usersWithoutRole.length}
          query={assignment.query}
          filter={assignment.filter}
          saving={assignment.saving}
          changeCount={assignment.changeCount}
          onQueryChange={assignment.setQuery}
          onFilterChange={assignment.setFilter}
          onToggle={assignment.toggle}
          onReset={assignment.reset}
          onSave={() => void assignment.save(openRole.id)}
        />
      }
      skills={
        <RoleSkillsPanel
          roleName={openRole.name}
          roleSkills={openRoleSkills}
          skillName={skillEdits.skillName}
          addingSkill={skillEdits.addingSkill}
          removingSkillId={skillEdits.removingSkillId}
          canSuggest={canSuggest}
          suggesting={suggestions.isSuggesting === openRole.id}
          applying={suggestions.applying}
          suggestionsOpen={suggestions.open}
          suggestions={suggestions.suggestions}
          selectedSuggestionKeys={suggestions.selectedKeys}
          suggestionError={suggestions.error}
          onSkillNameChange={skillEdits.setSkillName}
          onAddSkill={() => void skillEdits.addSkill()}
          onRemoveSkill={(skill) => void skillEdits.removeSkill(skill)}
          onSuggest={() => void suggestions.request(openRole.id)}
          onToggleSuggestion={suggestions.toggle}
          onApplySuggestions={() => void suggestions.apply(openRole.id)}
          onCloseSuggestions={suggestions.close}
        />
      }
    />
  ) : null;

  return (
    <>
      <div className="min-w-0">
        <RoleListToolbar
          query={roleQuery}
          gap={roleGap}
          sort={roleSort}
          shown={visibleRoles.length}
          total={roles.length}
          rolesWithoutMembers={roles.filter((role) => membersOf(role.id).length === 0).length}
          rolesWithoutSkills={roles.filter((role) => skillsOf(role.id).length === 0).length}
          narrowed={isListNarrowed(query)}
          creating={creation.show}
          onQueryChange={setRoleQuery}
          onGapChange={setRoleGap}
          onSortChange={setRoleSort}
          onReset={() => {
            setRoleQuery("");
            setRoleGap(null);
            setRoleSort("name");
          }}
          onToggleCreate={creation.toggleShow}
        />

        <UnassignedMembersHint
          members={usersWithoutRole}
          openRoleName={openRole?.name ?? null}
          onShowThem={() => assignment.setFilter("without")}
        />

        <AnimatePresence initial={false}>
          {creation.show && (
            <motion.section
              key="create-role"
              aria-label="New role"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition}
              className="overflow-hidden"
            >
              <CreateRoleForm
                name={creation.name}
                description={creation.description}
                catalog={skills}
                pickedSkills={creation.pickedSkills}
                suggestOnCreate={creation.suggestOnCreate}
                canSuggest={canSuggest}
                creating={creation.creating}
                onNameChange={creation.setName}
                onDescriptionChange={creation.setDescription}
                onPickedSkillsChange={creation.setPickedSkills}
                onSuggestOnCreateChange={creation.setSuggestOnCreate}
                onCreate={() => void creation.create()}
              />
            </motion.section>
          )}
        </AnimatePresence>

        {roles.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            {visibleRoles.length > 0 ? (
              <RoleList
                roles={visibleRoles}
                openRoleId={openRoleId}
                skillsOf={skillsOf}
                membersOf={membersOf}
                detail={detail}
                isStillOpen={(roleId) => openRoleIdRef.current === roleId}
                onSelect={open}
                onRequestDelete={setDeleteRoleId}
              />
            ) : (
              <p className="p-6 text-center text-sm text-app-text-muted">
                No roles match these filters.
              </p>
            )}
          </div>
        )}

        {roles.length === 0 && !creation.show && (
          <p className="mt-3 text-xs text-app-text-muted">
            No roles yet. Create the first one with “New role”.
          </p>
        )}
      </div>

      <DeleteRoleDialog
        open={deleteRoleId !== null}
        roleName={roleToDelete?.name}
        impact={deleteImpact}
        onClose={() => setDeleteRoleId(null)}
        onConfirm={() => void confirmDeleteRole()}
      />
    </>
  );
}
