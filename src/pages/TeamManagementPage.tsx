import { Users, ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamMemberFilters } from '../features/team-management/components/TeamMemberFilters';
import { TeamMemberCard } from '../features/team-management/components/TeamMemberCard';
import { RoleManagementTab } from '../features/team-management/components/RoleManagementTab';
import { TeamManagementTabSwitcher } from '../features/team-management/components/TeamManagementTabSwitcher';
import {
    TEAM_MANAGEMENT_TAB_ORDER,
    type TeamManagementTab,
    type TeamOverviewFilters,
    type TeamOverviewUser,
    type ProjectRole,
} from '../features/team-management/types';
import {
    getTeamOverview,
    getProjectRoles,
} from '../services/teamManagementService';
import { PageHeader } from '../components/layout/PageHeader';
import { SlidingTabPanel } from '../components/ui/SlidingTabPanel';

export function TeamManagementPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamOverviewUser[]>([]);
    const [roles, setRoles] = useState<ProjectRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TeamManagementTab>('members');
    const [filters, setFilters] = useState<TeamOverviewFilters>({
        roleId: 'all',
        sortBy: 'LONGEST_STEP',
    });

    const loadTeamOverview = useCallback(async () => {
        const [usersData, rolesData] = await Promise.all([
            getTeamOverview(),
            getProjectRoles(),
        ]);

        setUsers(usersData);
        setRoles(rolesData);
    }, []);

    useEffect(() => {
        async function loadInitialData() {
            await loadTeamOverview();
            setLoading(false);
        }

        void loadInitialData();
    }, [loadTeamOverview]);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <p className="text-sm text-app-text-muted">Loading team overview...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-app-bg">
            <header className="relative z-40 border-b border-app-border bg-app-bg">
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
                                    {activeTab === 'members'
                                        ? filteredUsers.length
                                        : roles.length}
                                </div>
                                <div className="text-xs font-medium text-app-brand-text">
                                    {activeTab === 'members'
                                        ? 'members'
                                        : roles.length === 1
                                          ? 'role'
                                          : 'roles'}
                                </div>
                            </div>
                        }
                    />
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8">
                <div className="mb-6">
                    <TeamManagementTabSwitcher
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>

                <SlidingTabPanel
                    activeKey={activeTab}
                    index={TEAM_MANAGEMENT_TAB_ORDER.indexOf(activeTab)}
                >
                    {activeTab === 'members' ? (
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
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <RoleManagementTab
                            roles={roles}
                            users={users}
                            onDataChanged={loadTeamOverview}
                        />
                    )}
                </SlidingTabPanel>
            </main>
        </div>
    );
}
