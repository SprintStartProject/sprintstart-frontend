import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { RoleCard } from './RoleCard';
import { buttonHoverMotion } from '../../../styles/tokens';
import {
    assignProjectRoleToUser,
    createProjectRole,
    createSkill,
    deleteProjectRole,
    deleteSkill,
    getSkills,
    reactivateSkill,
    unassignProjectRoleFromUser,
} from '../../../services/teamManagementService';
import { isSkillLinkedToRole } from '../types';
import type { ProjectRole, Skill, TeamOverviewUser } from '../types';

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
export function RoleManagementTab({
    roles,
    users,
    onDataChanged,
}: RoleManagementTabProps) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [creatingRole, setCreatingRole] = useState(false);

    const [skillName, setSkillName] = useState('');
    const [addingSkill, setAddingSkill] = useState(false);

    const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
    const [retireSkillId, setRetireSkillId] = useState<string | null>(null);

    // Ids ticked in the member list, and the snapshot taken when the role was
    // opened so confirming can send only the difference.
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [originalUserIds, setOriginalUserIds] = useState<string[]>([]);
    const [savingAssignment, setSavingAssignment] = useState(false);

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

    function openRole(roleId: string) {
        if (selectedRoleId === roleId) {
            closeRole();
            return;
        }

        const assignedUserIds = users
            .filter((user) => user.roles.some((role) => role.id === roleId))
            .map((user) => user.userId);

        setSelectedRoleId(roleId);
        setSelectedUserIds(assignedUserIds);
        setOriginalUserIds(assignedUserIds);
        setSkillName('');
    }

    function closeRole() {
        setSelectedRoleId(null);
        setSelectedUserIds([]);
        setOriginalUserIds([]);
        setSkillName('');
    }

    function toggleUser(userId: string) {
        setSelectedUserIds((current) =>
            current.includes(userId)
                ? current.filter((id) => id !== userId)
                : [...current, userId],
        );
    }

    const userIdsToAdd = selectedUserIds.filter(
        (id) => !originalUserIds.includes(id),
    );
    const userIdsToRemove = originalUserIds.filter(
        (id) => !selectedUserIds.includes(id),
    );
    const hasAssignChanges =
        userIdsToAdd.length > 0 || userIdsToRemove.length > 0;

    async function handleCreateRole() {
        if (!roleName.trim() || creatingRole) return;

        setCreatingRole(true);

        try {
            const newRole = await createProjectRole(
                roleName.trim(),
                roleDescription.trim(),
            );

            setRoleName('');
            setRoleDescription('');
            await onDataChanged();
            // Land on the new role: it is empty, so the next thing to do is
            // always to give it skills or members.
            openRole(newRole.id);
        } finally {
            setCreatingRole(false);
        }
    }

    async function confirmDeleteRole() {
        if (!deleteRoleId) return;

        const roleId = deleteRoleId;
        setDeleteRoleId(null);

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
    }

    async function handleAddSkill() {
        if (!selectedRole || !skillName.trim() || addingSkill) return;

        setAddingSkill(true);

        try {
            const newSkill = await createSkill(skillName.trim(), [
                selectedRole.id,
            ]);

            setSkills((current) =>
                current.some((skill) => skill.id === newSkill.id)
                    ? current.map((skill) =>
                          skill.id === newSkill.id ? newSkill : skill,
                      )
                    : [...current, newSkill],
            );

            setSkillName('');
        } finally {
            setAddingSkill(false);
        }
    }

    async function confirmRetireSkill() {
        if (!retireSkillId) return;

        const skillId = retireSkillId;
        setRetireSkillId(null);

        await deleteSkill(skillId);

        setSkills((current) =>
            current.map((skill) =>
                skill.id === skillId
                    ? { ...skill, status: 'RETIRED' as const }
                    : skill,
            ),
        );
    }

    async function handleReactivateSkill(skill: Skill) {
        const updated = await reactivateSkill(
            skill.id,
            skill.name,
            skill.roleIds,
        );

        setSkills((current) =>
            current.map((entry) => (entry.id === skill.id ? updated : entry)),
        );
    }

    async function handleSaveAssignment() {
        if (!selectedRole || !hasAssignChanges || savingAssignment) return;

        const roleId = selectedRole.id;
        setSavingAssignment(true);

        try {
            await Promise.all([
                ...userIdsToAdd.map((userId) =>
                    assignProjectRoleToUser(userId, roleId),
                ),
                ...userIdsToRemove.map((userId) =>
                    unassignProjectRoleFromUser(userId, roleId),
                ),
            ]);

            setOriginalUserIds(selectedUserIds);
            await onDataChanged();
        } finally {
            setSavingAssignment(false);
        }
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
                        : first.status === 'ACTIVE'
                          ? -1
                          : 1,
                ),
        [skills],
    );

    const selectedRoleSkills = selectedRole
        ? getRoleSkills(selectedRole.id)
        : [];

    // Worth surfacing on the overview: a member with no role is invisible in
    // the role cards, so without this they are only found by going through
    // every role and noticing who is missing.
    const usersWithoutRole = users.filter((user) => user.roles.length === 0);

    const roleToDelete = roles.find((role) => role.id === deleteRoleId);
    const skillToRetire = skills.find((skill) => skill.id === retireSkillId);

    const inputClassName =
        'w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand-border-strong';

    return (
        <>
            {/* Two columns rather than three stacked bands: the picker and the
                member list share the left column, and the narrow right column
                holds whatever the current step needs -- the create form while
                nothing is selected, the selected role's skills once something
                is.

                Explicit row and column placement, because the DOM order that
                stacks sensibly on mobile (roles, panel, members) is not the
                order the desktop grid wants. Pinning the cells lets one markup
                order serve both. */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                    <h3 className="text-sm font-semibold text-app-text">
                        Roles
                    </h3>
                    <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'}{' '}
                        in this project. Select one to manage its skills and
                        members.
                    </p>

                    {/* One container, two shapes: cards at rest, chips once a
                        role is open. The switch is instant -- morphing the two
                        was tried and could not be made to run smoothly with a
                        grid of cards animating at once.

                        `items-start` so the cards keep their natural height
                        instead of stretching to the tallest one in the row. */}
                    <div
                        className={
                            selectedRole
                                ? 'flex flex-wrap gap-2'
                                : 'grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3'
                        }
                    >
                        {roles.map((role) => (
                            <RoleCard
                                key={role.id}
                                role={role}
                                skills={getRoleSkills(role.id)}
                                memberCount={
                                    users.filter((user) =>
                                        user.roles.some(
                                            (userRole) =>
                                                userRole.id === role.id,
                                        ),
                                    ).length
                                }
                                compact={selectedRole !== null}
                                selected={selectedRoleId === role.id}
                                onSelect={openRole}
                                onRequestDelete={setDeleteRoleId}
                            />
                        ))}
                    </div>

                    {roles.length === 0 && (
                        <p className="text-xs text-app-text-muted">
                            No roles yet. Create one on the right.
                        </p>
                    )}

                    {/* Only on the overview: while a role is open the member
                        list below already shows everyone, with their roles. */}
                    {!selectedRole && usersWithoutRole.length > 0 && (
                        <div className="mt-6 border-t border-app-border pt-6">
                            <h4 className="text-sm font-semibold text-app-text">
                                Without a role
                            </h4>
                            <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                                {usersWithoutRole.length}{' '}
                                {usersWithoutRole.length === 1
                                    ? 'member is'
                                    : 'members are'}{' '}
                                not assigned to any role yet. Open a role to
                                give it to them.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {usersWithoutRole.map((user) => {
                                    const fullName = `${user.firstname} ${user.lastname}`;

                                    return (
                                        <span
                                            key={user.userId}
                                            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-app-border bg-app-surface px-2 py-1.5"
                                        >
                                            <UserAvatar
                                                profileIcon={user.profileIcon}
                                                fallbackName={fullName}
                                                seed={user.userId}
                                                size={24}
                                            />
                                            <span className="truncate text-sm font-medium text-app-text">
                                                {fullName}
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* No card: a divider is enough to set this column apart, and a
                    panel floating next to plain content made the two halves
                    read as unrelated. */}
                {selectedRole ? (
                    <section className="min-w-0 border-t border-app-border pt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                {/* Says what the column is for. Without it
                                        the panel opens on a bare role name and
                                        the skills below have to be read before
                                        it is clear what this half does. */}
                                <p className="text-base font-semibold text-app-brand">
                                    Manage role
                                </p>
                                <h3 className="mt-0.5 truncate text-sm font-semibold text-app-text">
                                    {selectedRole.name}
                                </h3>
                                {selectedRole.description && (
                                    <p className="mt-1 text-xs text-app-text-muted">
                                        {selectedRole.description}
                                    </p>
                                )}
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

                        <h4 className="mt-5 text-sm font-semibold text-app-text">
                            Skills
                        </h4>
                        <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                            Skills of this role, shown in the skill assessment
                            flow for assigned members.
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {selectedRoleSkills.map((skill) => (
                                <span
                                    key={skill.id}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                                        skill.status === 'RETIRED'
                                            ? 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                                            : 'border-app-border bg-app-bg text-app-text'
                                    }`}
                                >
                                    {skill.name}

                                    {skill.status === 'RETIRED' ? (
                                        <>
                                            <span className="font-medium">
                                                Retired
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Reactivate ${skill.name}`}
                                                onClick={() =>
                                                    void handleReactivateSkill(
                                                        skill,
                                                    )
                                                }
                                                className="text-app-text-muted transition-colors hover:text-app-success-text"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label={`Retire ${skill.name}`}
                                            onClick={() =>
                                                setRetireSkillId(skill.id)
                                            }
                                            className="text-app-text-muted transition-colors hover:text-app-danger-text"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    )}
                                </span>
                            ))}

                            {selectedRoleSkills.length === 0 && (
                                <p className="text-xs text-app-text-muted">
                                    No skills added yet.
                                </p>
                            )}
                        </div>

                        <div className="mt-4 space-y-2">
                            <label htmlFor="new-skill-name" className="sr-only">
                                Add skill to {selectedRole.name}
                            </label>
                            <input
                                id="new-skill-name"
                                value={skillName}
                                onChange={(event) =>
                                    setSkillName(event.target.value)
                                }
                                placeholder="Add skill, e.g. React"
                                className={inputClassName}
                            />

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void handleAddSkill()}
                                    disabled={!skillName.trim() || addingSkill}
                                    className="rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {addingSkill ? 'Adding...' : 'Add skill'}
                                </button>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="min-w-0 border-t border-app-border pt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <h3 className="text-sm font-semibold text-app-text">
                            Create role
                        </h3>
                        <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                            A new role starts empty; select it to add skills and
                            assign members.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label
                                    htmlFor="new-role-name"
                                    className="mb-1 block text-xs font-medium text-app-text-muted"
                                >
                                    Name
                                </label>
                                <input
                                    id="new-role-name"
                                    value={roleName}
                                    onChange={(event) =>
                                        setRoleName(event.target.value)
                                    }
                                    placeholder="e.g. Backend"
                                    className={inputClassName}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="new-role-description"
                                    className="mb-1 block text-xs font-medium text-app-text-muted"
                                >
                                    Description
                                </label>
                                <textarea
                                    id="new-role-description"
                                    value={roleDescription}
                                    onChange={(event) =>
                                        setRoleDescription(event.target.value)
                                    }
                                    rows={2}
                                    placeholder="What this role is responsible for"
                                    className={`${inputClassName} resize-none`}
                                />
                            </div>

                            <div className="flex justify-end">
                                <motion.button
                                    type="button"
                                    onClick={() => void handleCreateRole()}
                                    disabled={!roleName.trim() || creatingRole}
                                    {...buttonHoverMotion}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    {creatingRole
                                        ? 'Creating...'
                                        : 'Create role'}
                                </motion.button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Directly under the picker in the same column, so the eye
                    travels roles -> members without crossing the empty band
                    that sitting below the skills panel left behind. */}
                {selectedRole && (
                    <section className="min-w-0 lg:col-start-1 lg:row-start-2">
                        <div>
                            <h4 className="text-sm font-semibold text-app-text">
                                Members
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
                                Tick members to give them {selectedRole.name},
                                untick to take it away —{' '}
                                {selectedUserIds.length} selected.
                            </p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {users.map((user) => {
                                const isChecked = selectedUserIds.includes(
                                    user.userId,
                                );
                                const fullName = `${user.firstname} ${user.lastname}`;

                                return (
                                    <label
                                        key={user.userId}
                                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                                            isChecked
                                                ? 'border-app-brand bg-app-brand-soft'
                                                : 'border-app-border bg-app-surface hover:border-app-brand-border-strong hover:bg-app-surface-hover'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={savingAssignment}
                                            onChange={() =>
                                                toggleUser(user.userId)
                                            }
                                            className="h-4 w-4 shrink-0 accent-app-brand"
                                        />

                                        <UserAvatar
                                            profileIcon={user.profileIcon}
                                            fallbackName={fullName}
                                            seed={user.userId}
                                            size={40}
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-app-text">
                                                {fullName}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-app-text-muted">
                                                {user.roles.length === 0
                                                    ? 'No roles'
                                                    : user.roles
                                                          .map(
                                                              (role) =>
                                                                  role.name,
                                                          )
                                                          .join(', ')}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}

                            {users.length === 0 && (
                                <p className="text-xs text-app-text-muted">
                                    No members in this project yet.
                                </p>
                            )}
                        </div>

                        {/* Below the list, not above it: the buttons act
                                on choices made in the list, so they should be
                                where the eye ends up rather than where it
                                started. */}
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleResetAssignment}
                                disabled={!hasAssignChanges || savingAssignment}
                                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Reset
                            </button>

                            <button
                                type="button"
                                onClick={() => void handleSaveAssignment()}
                                disabled={!hasAssignChanges || savingAssignment}
                                className="rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {savingAssignment
                                    ? 'Saving...'
                                    : 'Save changes'}
                            </button>
                        </div>
                    </section>
                )}
            </div>

            <AlertDialog
                isOpen={Boolean(deleteRoleId || retireSkillId)}
                title={
                    retireSkillId ? 'Confirm retirement' : 'Confirm deletion'
                }
                description={
                    <>
                        Are you sure you want to{' '}
                        {retireSkillId ? 'retire' : 'delete'}{' '}
                        <span className="font-medium text-app-text">
                            {roleToDelete?.name ??
                                skillToRetire?.name ??
                                'this item'}
                        </span>
                        ?
                        {retireSkillId
                            ? ' Existing assessments remain available, but the skill can no longer be assigned or assessed.'
                            : ' This action cannot be undone.'}
                    </>
                }
                confirmLabel={retireSkillId ? 'Retire' : 'Delete'}
                variant="danger"
                onClose={() => {
                    setDeleteRoleId(null);
                    setRetireSkillId(null);
                }}
                onConfirm={() => {
                    if (deleteRoleId) {
                        void confirmDeleteRole();
                    }

                    if (retireSkillId) {
                        void confirmRetireSkill();
                    }
                }}
            />
        </>
    );
}
