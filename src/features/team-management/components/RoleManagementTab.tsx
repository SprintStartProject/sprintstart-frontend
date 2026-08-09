import { Check, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AnimatePresence,
    motion,
    useAnimationControls,
    useReducedMotion,
} from 'framer-motion';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { Button } from '../../../components/ui/Button';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { RoleCard } from './RoleCard';
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

    /**
     * The roles column, and its height from just before the last open/close.
     *
     * Fading the panels in was not enough: the page still reached its new shape
     * in a single frame -- the card grid collapsing to a chip row is a few
     * hundred pixels -- and a fade laid over a jump still reads as a jump. So
     * the two heights that change are animated instead: this column, from what
     * it measured before the click to what it measures after, and the detail
     * panel from zero to its content height. Everything below them then travels
     * continuously rather than teleporting.
     */
    const rolesRef = useRef<HTMLDivElement>(null);
    const detailRef = useRef<HTMLDivElement>(null);
    const rolesHeightBeforeRef = useRef<number | null>(null);
    const rolesControls = useAnimationControls();
    const [isRolesResizing, setIsRolesResizing] = useState(false);

    function captureRolesHeight() {
        rolesHeightBeforeRef.current = rolesRef.current?.offsetHeight ?? null;
    }

    useLayoutEffect(() => {
        const element = rolesRef.current;
        const heightBefore = rolesHeightBeforeRef.current;
        rolesHeightBeforeRef.current = null;

        if (!element || heightBefore === null) return;

        const heightAfter = element.offsetHeight;
        if (heightBefore === heightAfter) return;

        // Clipped only while it runs: the cards' hover shadow would be cut off
        // by a permanent `overflow: hidden`.
        setIsRolesResizing(true);
        rolesControls.set({ height: heightBefore });

        void rolesControls
            .start({ height: heightAfter, transition: expandTransition })
            .then(() => {
                // Back to `auto`, so later content changes size the column
                // normally instead of being trapped at the measured height.
                rolesControls.set({ height: 'auto' });
                setIsRolesResizing(false);
            });
    }, [expandTransition, rolesControls, selectedRoleId]);

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
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'nearest',
        });
    }, [prefersReducedMotion]);

    function openRole(roleId: string) {
        captureRolesHeight();

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
        captureRolesHeight();
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
    // Additions and removals both count: the button saves one batch, and
    // "3 changes" is the honest size of what confirming is about to send.
    const assignChangeCount = userIdsToAdd.length + userIdsToRemove.length;
    const hasAssignChanges = assignChangeCount > 0;

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

    const getRoleMembers = useCallback(
        (roleId: string) =>
            users.filter((user) =>
                user.roles.some((userRole) => userRole.id === roleId),
            ),
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
                (heldOriginally.has(first.userId) ? 0 : 1) -
                (heldOriginally.has(second.userId) ? 0 : 1),
        );
    }, [originalUserIds, users]);

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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                {/* Spans both columns once a role is open, because the create
                    form beside it gives way to the open role's panel. */}
                <motion.div
                    ref={rolesRef}
                    animate={rolesControls}
                    className={`relative min-w-0 lg:row-start-1 ${
                        selectedRole ? 'lg:col-span-2' : 'lg:col-start-1'
                    } ${isRolesResizing ? 'overflow-hidden' : ''}`}
                >
                    <h3 className="text-sm font-semibold text-app-text">
                        Roles
                    </h3>
                    <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'}{' '}
                        in this project. Select one to manage its skills and
                        members.
                    </p>

                    {/* Cards at rest, chips once a role is open: the open role
                        then holds everything about itself in the panel below,
                        so repeating it in a card would only take up room. */}
                    {/* The `key` drives the animation: changing it swaps the
                        list, the outgoing shape shrinks away and the incoming
                        cards grow in, while the column's measured height
                        animates underneath.

                        `mode="popLayout"` is what makes that measurement work:
                        the outgoing copy is pulled out of flow before the
                        height effect above reads the column, so it measures the
                        new shape alone instead of a column briefly holding
                        both. */}
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.div
                            key={selectedRole ? 'chips' : 'cards'}
                            exit={{ opacity: 0, scale: 0.94 }}
                            transition={expandTransition}
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
                                    members={getRoleMembers(role.id)}
                                    compact={selectedRole !== null}
                                    selected={selectedRoleId === role.id}
                                    transition={expandTransition}
                                    onSelect={openRole}
                                    onRequestDelete={setDeleteRoleId}
                                />
                            ))}
                        </motion.div>
                    </AnimatePresence>

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
                </motion.div>

                {/* Only while nothing is open: the open role takes this slot,
                    so creating and managing never compete for attention. No
                    card around it -- a divider is enough to set the column
                    apart, and a panel floating next to plain content made the
                    two halves read as unrelated. */}
                {/* `mode="popLayout"` so the form leaves the grid the moment
                    it starts moving: kept in flow it would still occupy the
                    right column while the roles column is already widening
                    into it, and the two would sit on top of each other for the
                    length of the slide. */}
                <AnimatePresence initial={false} mode="popLayout">
                    {!selectedRole && (
                        <motion.section
                            key="create-role"
                            initial={{ opacity: 0, x: 48 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 48 }}
                            transition={expandTransition}
                            className="min-w-0 border-t border-app-border pt-6 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
                        >
                            <h3 className="text-sm font-semibold text-app-text">
                                Create role
                            </h3>
                            <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                                A new role starts empty; open it to add skills
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
                                    <Button
                                        variant="primary"
                                        onClick={() => void handleCreateRole()}
                                        disabled={!roleName.trim()}
                                        loading={creatingRole}
                                        icon={<Plus className="h-4 w-4" />}
                                    >
                                        {creatingRole
                                            ? 'Creating...'
                                            : 'Create role'}
                                    </Button>
                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* The open role, as one card across both columns. Everything
                    about it lives in here -- who holds it, and which skills it
                    carries -- so working on a role never means looking at two
                    places at once. */}
                <AnimatePresence initial={false}>
                    {selectedRole && (
                        // Height on the wrapper, padding on the card inside: a
                        // padded element cannot animate to zero height, it
                        // stops at its own padding and pops the rest away.
                        <motion.div
                            key="role-detail"
                            ref={detailRef}
                            onAnimationComplete={() => {
                                // Also fires for the exit, when there is
                                // nothing left to scroll to.
                                if (selectedRole) scrollDetailIntoView();
                            }}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={expandTransition}
                            className="min-w-0 overflow-hidden lg:col-span-2 lg:row-start-2"
                        >
                            <section className="rounded-2xl border border-app-brand bg-app-surface p-4 ring-1 ring-app-brand sm:p-6">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
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

                                {/* Members take the room, skills sit in a narrow column
                            beside them: the member grid is the part that grows
                            with the team, the skill list stays short. */}
                                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold text-app-text">
                                            Members
                                        </h4>
                                        <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
                                            Ticked members hold{' '}
                                            {selectedRole.name}. Untick to take
                                            it away — {selectedUserIds.length}{' '}
                                            selected.
                                        </p>

                                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                            {membersForAssignment.map(
                                                (user) => {
                                                    const isChecked =
                                                        selectedUserIds.includes(
                                                            user.userId,
                                                        );
                                                    const heldBefore =
                                                        originalUserIds.includes(
                                                            user.userId,
                                                        );
                                                    // The two pending states,
                                                    // shown in the colour of
                                                    // the action they will
                                                    // perform on save.
                                                    const isBeingAdded =
                                                        isChecked &&
                                                        !heldBefore;
                                                    const isBeingRemoved =
                                                        !isChecked &&
                                                        heldBefore;
                                                    const fullName = `${user.firstname} ${user.lastname}`;

                                                    return (
                                                        <label
                                                            key={user.userId}
                                                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                                                                isBeingAdded
                                                                    ? 'border-app-success-border bg-app-success-bg'
                                                                    : isBeingRemoved
                                                                      ? 'border-app-danger-border bg-app-danger-bg'
                                                                      : isChecked
                                                                        ? 'border-app-brand bg-app-brand-soft'
                                                                        : 'border-app-border bg-app-bg hover:border-app-brand-border-strong hover:bg-app-surface-hover'
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
                                                                checked={
                                                                    isChecked
                                                                }
                                                                disabled={
                                                                    savingAssignment
                                                                }
                                                                onChange={() =>
                                                                    toggleUser(
                                                                        user.userId,
                                                                    )
                                                                }
                                                                className="peer sr-only"
                                                            />

                                                            <span
                                                                aria-hidden="true"
                                                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-app-focus ${
                                                                    isBeingAdded
                                                                        ? 'border-app-success-border bg-app-success-bg text-app-success-text'
                                                                        : isBeingRemoved
                                                                          ? 'border-app-danger-border bg-app-danger-bg text-app-danger-text'
                                                                          : isChecked
                                                                            ? 'border-app-brand bg-app-brand text-app-text-inverse'
                                                                            : 'border-app-border bg-app-surface'
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
                                                                profileIcon={
                                                                    user.profileIcon
                                                                }
                                                                fallbackName={
                                                                    fullName
                                                                }
                                                                seed={
                                                                    user.userId
                                                                }
                                                                size={40}
                                                            />

                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-medium text-app-text">
                                                                    {fullName}
                                                                </span>
                                                                <span className="mt-0.5 block truncate text-xs text-app-text-muted">
                                                                    {isBeingAdded
                                                                        ? 'Will be added'
                                                                        : isBeingRemoved
                                                                          ? 'Will be removed'
                                                                          : user
                                                                                  .roles
                                                                                  .length ===
                                                                              0
                                                                            ? 'No roles'
                                                                            : user.roles
                                                                                  .map(
                                                                                      (
                                                                                          role,
                                                                                      ) =>
                                                                                          role.name,
                                                                                  )
                                                                                  .join(
                                                                                      ', ',
                                                                                  )}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    );
                                                },
                                            )}

                                            {users.length === 0 && (
                                                <p className="text-xs text-app-text-muted">
                                                    No members in this project
                                                    yet.
                                                </p>
                                            )}
                                        </div>

                                        {/* Below the list, not above it: the buttons
                                    act on choices made in the list, so they
                                    should be where the eye ends up rather than
                                    where it started. */}
                                        <div className="mt-4 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={handleResetAssignment}
                                                disabled={
                                                    !hasAssignChanges ||
                                                    savingAssignment
                                                }
                                                className="rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Reset
                                            </button>

                                            <Button
                                                variant="primary"
                                                onClick={() =>
                                                    void handleSaveAssignment()
                                                }
                                                disabled={!hasAssignChanges}
                                                loading={savingAssignment}
                                            >
                                                {savingAssignment
                                                    ? 'Saving...'
                                                    : hasAssignChanges
                                                      ? `Save ${assignChangeCount} ${
                                                            assignChangeCount ===
                                                            1
                                                                ? 'change'
                                                                : 'changes'
                                                        }`
                                                      : 'Save changes'}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="min-w-0 border-t border-app-border pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                                        <h4 className="text-sm font-semibold text-app-text">
                                            Skills
                                        </h4>
                                        <p className="mb-3 mt-1 text-xs leading-relaxed text-app-text-muted">
                                            Skills of this role, shown in the
                                            skill assessment flow for assigned
                                            members.
                                        </p>

                                        <div className="flex flex-wrap gap-2">
                                            {selectedRoleSkills.map((skill) => (
                                                <span
                                                    key={skill.id}
                                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                                                        skill.status ===
                                                        'RETIRED'
                                                            ? 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                                                            : 'border-app-border bg-app-bg text-app-text'
                                                    }`}
                                                >
                                                    {skill.name}

                                                    {skill.status ===
                                                    'RETIRED' ? (
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
                                                                setRetireSkillId(
                                                                    skill.id,
                                                                )
                                                            }
                                                            className="text-app-text-muted transition-colors hover:text-app-danger-text"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))}

                                            {selectedRoleSkills.length ===
                                                0 && (
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
                                                    setSkillName(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Add skill, e.g. React"
                                                className={inputClassName}
                                            />

                                            <div className="flex justify-end">
                                                <Button
                                                    variant="primary"
                                                    onClick={() =>
                                                        void handleAddSkill()
                                                    }
                                                    disabled={!skillName.trim()}
                                                    loading={addingSkill}
                                                >
                                                    {addingSkill
                                                        ? 'Adding...'
                                                        : 'Add skill'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </motion.div>
                    )}
                </AnimatePresence>
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
