import { Users, ArrowLeft, ChevronsLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamMemberFilters } from '../features/team-management/components/TeamMemberFilters';
import { TeamMemberCard } from '../features/team-management/components/TeamMemberCard';
import { RolesSkillsPanel } from '../features/team-management/components/RolesSkillsPanel';
import type {
    TeamOverviewFilters,
    TeamOverviewUser,
    ProjectRole,
} from '../features/team-management/types';
import {
    getTeamOverview,
    getProjectRoles,
    assignProjectRoleToUser,
    unassignProjectRoleFromUser,
} from '../services/teamManagementService';
import { PageHeader } from '../components/layout/PageHeader';

export function TeamManagementPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamOverviewUser[]>([]);
    const [roles, setRoles] = useState<ProjectRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<TeamOverviewFilters>({
        roleId: 'all',
        sortBy: 'LONGEST_STEP',
    });
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [assigningRoleId, setAssigningRoleId] = useState<string | null>(null);
    // Snapshot of who already had the role when assign-mode was entered, so
    // confirming can diff against it: newly checked members get the role,
    // unchecked members that had it get it removed.
    const [originalAssignedUserIds, setOriginalAssignedUserIds] = useState<
        string[]
    >([]);
    const [assigning, setAssigning] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    // Opened by an explicit click rather than by hovering. A pinned panel is
    // only closed by the collapse chevron, never by moving the pointer.
    const [panelPinned, setPanelPinned] = useState(false);
    const [rolesModalOpen, setRolesModalOpen] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    // The panel force-opens while an assignment is running so the in-row
    // confirm/cancel controls can never be collapsed away mid-action.
    const isPanelExpanded =
        panelOpen || panelPinned || assigningRoleId !== null;

    function openPanel() {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setPanelOpen(true);
    }

    function pinPanel() {
        openPanel();
        setPanelPinned(true);
    }

    function collapsePanel() {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        setPanelPinned(false);
        setPanelOpen(false);
    }

    /**
     * Collapses shortly after the pointer moves into the member list.
     *
     * Deliberately driven by *entering* the list rather than by leaving the
     * panel: the panel sits inside the centred page frame, so the gutter
     * between it and the window edge would otherwise count as "left" and
     * collapse the panel while the pointer is still heading for it.
     */
    function scheduleClose() {
        if (panelPinned || assigningRoleId !== null || rolesModalOpen) return;

        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
        }

        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null;
            setPanelOpen(false);
        }, 200);
    }

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        async function loadTeamOverview() {
            const [usersData, rolesData] = await Promise.all([
                getTeamOverview(),
                getProjectRoles(),
            ]);
            setUsers(usersData);
            setRoles(rolesData);
            setLoading(false);
        }

        void loadTeamOverview();
    }, []);

    const filteredUsers = useMemo(() => {
        const result = users.filter((user) => {
            return (
                filters.roleId === 'all' ||
                user.roles.some((role) => role.id === filters.roleId)
            );
        });

        const getStartedAtTime = (user: TeamOverviewUser) => {
            if (!user.currentStep?.startedAt) {
                return 0;
            }

            return new Date(user.currentStep.startedAt).getTime();
        };

        result.sort((a, b) => {
            switch (filters.sortBy) {
                case 'LONGEST_STEP':
                    return getStartedAtTime(a) - getStartedAtTime(b);

                case 'SHORTEST_STEP':
                    return getStartedAtTime(b) - getStartedAtTime(a);

                case 'HIGHEST_PROGRESS':
                    return b.progressPercentage - a.progressPercentage;

                case 'LOWEST_PROGRESS':
                    return a.progressPercentage - b.progressPercentage;

                default:
                    return 0;
            }
        });

        return result;
    }, [users, filters]);

    function toggleUserSelected(userId: string) {
        setSelectedUserIds((current) =>
            current.includes(userId)
                ? current.filter((id) => id !== userId)
                : [...current, userId],
        );
    }

    function handleStartAssign(roleId: string) {
        if (assigningRoleId === roleId) {
            handleCancelAssign();
            return;
        }

        const assignedUserIds = users
            .filter((user) => user.roles.some((role) => role.id === roleId))
            .map((user) => user.userId);

        setAssigningRoleId(roleId);
        setOriginalAssignedUserIds(assignedUserIds);
        setSelectedUserIds(assignedUserIds);
    }

    function handleCancelAssign() {
        setAssigningRoleId(null);
        setSelectedUserIds([]);
        setOriginalAssignedUserIds([]);
    }

    const userIdsToAdd = assigningRoleId
        ? selectedUserIds.filter((id) => !originalAssignedUserIds.includes(id))
        : [];
    const userIdsToRemove = assigningRoleId
        ? originalAssignedUserIds.filter((id) => !selectedUserIds.includes(id))
        : [];
    const hasAssignChanges = userIdsToAdd.length > 0 || userIdsToRemove.length > 0;

    async function handleConfirmAssign() {
        if (!assigningRoleId || !hasAssignChanges) return;

        setAssigning(true);

        try {
            await Promise.all([
                ...userIdsToAdd.map((userId) =>
                    assignProjectRoleToUser(userId, assigningRoleId),
                ),
                ...userIdsToRemove.map((userId) =>
                    unassignProjectRoleFromUser(userId, assigningRoleId),
                ),
            ]);

            setAssigningRoleId(null);
            setSelectedUserIds([]);
            setOriginalAssignedUserIds([]);

            const [usersData, rolesData] = await Promise.all([
                getTeamOverview(),
                getProjectRoles(),
            ]);
            setUsers(usersData);
            setRoles(rolesData);
        } finally {
            setAssigning(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <p className="text-sm text-app-text-muted">Loading team overview...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app-bg">
            {/* Opaque and above the collapsed rail, so the rail never bleeds
                into the header area. */}
            <header className="relative z-40 border-b border-app-border bg-app-bg">
                <div
                    className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 ${
                        isPanelExpanded ? "" : "lg:pr-16"
                    }`}
                >
                    <button
                        onClick={() => void navigate('/pm-dashboard')}
                        className="inline-flex items-center gap-2 text-sm text-app-text-muted hover:text-app-text transition-all mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to PM-Dashboard
                    </button>

                    <PageHeader
                        icon={Users}
                        title="Team Management"
                        subtitle="Monitor onboarding progress across team members and manage project roles."
                        actions={
                            <div className="rounded-2xl border border-app-brand-border bg-app-brand-soft px-4 py-2 text-right">
                                <div className="text-3xl font-bold text-app-brand">
                                    {filteredUsers.length}
                                </div>
                                <div className="text-xs font-medium text-app-brand-text">
                                    members
                                </div>
                            </div>
                        }
                    />
                </div>
            </header>

            <main
                className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8 ${
                    isPanelExpanded ? "" : "lg:pr-16"
                }`}
            >
                <div
                    className={`grid grid-cols-1 gap-6 ${
                        isPanelExpanded ? "lg:grid-cols-[minmax(0,1fr)_16rem]" : ""
                    }`}
                >
                    <div className="min-w-0" onMouseEnter={scheduleClose}>
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-app-text">
                                    Team members
                                </h2>
                                <p className="text-sm text-app-text-muted">
                                    {filteredUsers.length} of {users.length} members shown
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <TeamMemberFilters
                                    roles={roles}
                                    filters={filters}
                                    onFiltersChange={setFilters}
                                />
                            </div>
                        </div>

                        {filteredUsers.length === 0 ? (
                            <div className="rounded-3xl border border-app-border bg-app-surface p-8 text-center">
                                <p className="text-sm text-app-text-muted">
                                    No team members found for this filter.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredUsers.map((user) => (
                                    <TeamMemberCard
                                        key={user.userId}
                                        user={user}
                                        selectable={assigningRoleId !== null}
                                        selected={selectedUserIds.includes(user.userId)}
                                        onToggleSelect={toggleUserSelected}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {isPanelExpanded ? (
                        <div
                            onMouseEnter={openPanel}
                            className="border-t border-app-border pt-6 lg:flex lg:min-h-screen lg:flex-col lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
                        >
                            <div className="lg:sticky lg:top-6">
                                <RolesSkillsPanel
                                    assigningRoleId={assigningRoleId}
                                    selectedCount={selectedUserIds.length}
                                    hasChanges={hasAssignChanges}
                                    assigning={assigning}
                                    onStartAssign={handleStartAssign}
                                    onCancelAssign={handleCancelAssign}
                                    onConfirmAssign={() => void handleConfirmAssign()}
                                    onModalOpenChange={setRolesModalOpen}
                                    onCollapse={
                                        assigningRoleId === null
                                            ? collapsePanel
                                            : undefined
                                    }
                                />
                            </div>
                        </div>
                    ) : (
                        /* Collapsed on mobile: a normal full-width toggle, since
                           the layout is stacked there anyway. */
                        <button
                            type="button"
                            onClick={pinPanel}
                            aria-expanded={false}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text lg:hidden"
                        >
                            <ChevronsLeft className="h-4 w-4 shrink-0" />
                            <span className="text-xs font-medium">Role Management</span>
                        </button>
                    )}
                </div>
            </main>

            {/* Collapsed rail, pinned to the window edge so no page gutter is
                wasted to its right. The page keeps a matching right padding so
                content never slides underneath it. Hovering opens the panel;
                clicking still works for keyboard and touch users. */}
            {!isPanelExpanded && (
                <button
                    type="button"
                    onClick={pinPanel}
                    onMouseEnter={openPanel}
                    onFocus={pinPanel}
                    aria-expanded={false}
                    aria-label="Expand role management"
                    className="fixed inset-y-0 right-0 z-30 hidden w-10 flex-col items-center justify-center gap-2 border-l border-app-border bg-app-bg text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text lg:flex"
                >
                    <ChevronsLeft className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs font-medium [writing-mode:vertical-rl]">
                        Role Management
                    </span>
                </button>
            )}

            {/* Invisible edge strip while expanded, covering the window-edge
                band the collapsed rail occupies. Keeps the panel open while
                the pointer rests there, so it does not flip back and forth. */}
            {isPanelExpanded && (
                <div
                    aria-hidden="true"
                    onMouseEnter={openPanel}
                    className="fixed inset-y-0 right-0 z-20 hidden w-10 lg:block"
                />
            )}
        </div>
    );
}
