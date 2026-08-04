import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { UserAvatar } from '../../../components/common/UserAvatar';
import {
    buttonHoverMotion,
    slidingIndicatorSpringToken,
} from '../../../styles/tokens';
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

/**
 * Both side panels enter from and leave to the right, so the swap reads as one
 * panel being pushed out by the next rather than as two unrelated fades.
 */
const panelSlideVariants = {
    initial: { opacity: 0, x: 32 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 32 },
};

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
    const prefersReducedMotion = useReducedMotion();
    const panelTransition = prefersReducedMotion
        ? { duration: 0 }
        : slidingIndicatorSpringToken;

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
    const selectedRoleSkills = selectedRole
        ? skills
              .filter((skill) => isSkillLinkedToRole(skill, selectedRole.id))
              .sort((first, second) =>
                  first.status === second.status
                      ? first.name.localeCompare(second.name)
                      : first.status === 'ACTIVE'
                        ? -1
                        : 1,
              )
        : [];

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
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'} in
                        this project. Select one to manage its skills and
                        members.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {roles.map((role) => {
                            const isSelected = selectedRoleId === role.id;
                            const memberCount = users.filter((user) =>
                                user.roles.some(
                                    (userRole) => userRole.id === role.id,
                                ),
                            ).length;

                            return (
                                // A wrapper rather than one button: the delete
                                // control cannot be nested inside the select
                                // control.
                                <div
                                    key={role.id}
                                    className={`inline-flex max-w-full items-center gap-1 rounded-xl border px-2 py-1.5 transition-all duration-200 ${
                                        isSelected
                                            ? 'border-app-brand bg-app-brand-soft'
                                            : 'border-app-border bg-app-surface hover:border-app-brand-border-strong hover:bg-app-surface-hover'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => openRole(role.id)}
                                        aria-pressed={isSelected}
                                        className="flex min-w-0 items-center gap-2 px-1 py-0.5 text-left"
                                    >
                                        <span className="truncate text-sm font-medium text-app-text">
                                            {role.name}
                                        </span>
                                        <span
                                            className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                                                isSelected
                                                    ? 'bg-app-brand/20 text-app-brand-text'
                                                    : 'bg-app-bg text-app-text-subtle'
                                            }`}
                                        >
                                            {memberCount}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        aria-label={`Delete ${role.name}`}
                                        onClick={() => setDeleteRoleId(role.id)}
                                        className="shrink-0 rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-danger-text"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            );
                        })}

                        {roles.length === 0 && (
                            <p className="text-xs text-app-text-muted">
                                No roles yet. Create one on the right.
                            </p>
                        )}
                    </div>
                </div>

                {/* No card: a divider is enough to set this column apart, and a
                    panel floating next to plain content made the two halves
                    read as unrelated. `mode="wait"` rather than an overlap, so
                    the divider is never briefly missing mid-swap. */}
                <AnimatePresence initial={false} mode="wait">
                    {selectedRole ? (
                        <motion.section
                            key="role-skills"
                            initial={panelSlideVariants.initial}
                            animate={panelSlideVariants.animate}
                            exit={panelSlideVariants.exit}
                            transition={panelTransition}
                            className="min-w-0 border-t border-app-border pt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-semibold text-app-text">
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

                            <h4 className="mt-4 text-xs font-medium text-app-text-muted">
                                Skills
                            </h4>
                            <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                                Skills of this role, shown in the skill
                                assessment flow for assigned members.
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
                                <label
                                    htmlFor="new-skill-name"
                                    className="sr-only"
                                >
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
                                        disabled={
                                            !skillName.trim() || addingSkill
                                        }
                                        className="rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {addingSkill ? 'Adding...' : 'Add skill'}
                                    </button>
                                </div>
                            </div>
                        </motion.section>
                    ) : (
                        <motion.section
                            key="create-role"
                            initial={panelSlideVariants.initial}
                            animate={panelSlideVariants.animate}
                            exit={panelSlideVariants.exit}
                            transition={panelTransition}
                            className="min-w-0 border-t border-app-border pt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
                        >
                            <h3 className="text-sm font-semibold text-app-text">
                                Create role
                            </h3>
                            <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                                A new role starts empty; select it to add skills
                                and assign members.
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
                                            setRoleDescription(
                                                event.target.value,
                                            )
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
                                        disabled={
                                            !roleName.trim() || creatingRole
                                        }
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
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* Directly under the picker in the same column, so the eye
                    travels roles -> members without crossing the empty band
                    that sitting below the skills panel left behind. */}
                <AnimatePresence initial={false}>
                    {selectedRole && (
                        <motion.section
                            key="role-members"
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={panelTransition}
                            className="min-w-0 lg:col-start-1 lg:row-start-2"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-app-text">
                                        Members
                                    </h4>
                                    <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
                                        Tick members to give them{' '}
                                        {selectedRole.name}, untick to take it
                                        away — {selectedUserIds.length} selected.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetAssignment}
                                        disabled={
                                            !hasAssignChanges || savingAssignment
                                        }
                                        className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Reset
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleSaveAssignment()
                                        }
                                        disabled={
                                            !hasAssignChanges || savingAssignment
                                        }
                                        className="rounded-xl bg-app-brand px-4 py-2 text-sm font-medium text-app-text-inverse transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {savingAssignment
                                            ? 'Saving...'
                                            : 'Save changes'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {users.map((user) => {
                                    const isChecked = selectedUserIds.includes(
                                        user.userId,
                                    );
                                    const fullName = `${user.firstname} ${user.lastname}`;

                                    return (
                                        <label
                                            key={user.userId}
                                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200 ${
                                                isChecked
                                                    ? 'border-app-brand bg-app-brand-soft'
                                                    : 'border-app-border bg-app-bg hover:border-app-brand-border-strong hover:bg-app-surface-hover'
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
                                                size={28}
                                            />

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-app-text">
                                                    {fullName}
                                                </span>
                                                <span className="block truncate text-xs text-app-text-muted">
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
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>

            <AlertDialog
                isOpen={Boolean(deleteRoleId || retireSkillId)}
                title={retireSkillId ? 'Confirm retirement' : 'Confirm deletion'}
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
