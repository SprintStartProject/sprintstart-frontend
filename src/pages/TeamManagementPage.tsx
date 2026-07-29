import { Users, ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
            <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
                    <div className="min-w-0">
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

                    <div className="border-t border-app-border pt-6 lg:min-h-screen lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <div className="lg:sticky lg:top-6">
                            <RolesSkillsPanel
                                assigningRoleId={assigningRoleId}
                                selectedCount={selectedUserIds.length}
                                hasChanges={hasAssignChanges}
                                assigning={assigning}
                                onStartAssign={handleStartAssign}
                                onCancelAssign={handleCancelAssign}
                                onConfirmAssign={() => void handleConfirmAssign()}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
