import { Users, ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamMemberFilters } from '../features/team-management/components/TeamMemberFilters';
import { TeamMemberCard } from '../features/team-management/components/TeamMemberCard';
import { RoleManagementTab } from '../features/team-management/components/RoleManagementTab';
import { ProjectManagementTab } from '../features/team-management/components/ProjectManagementTab';
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
import {
    projectService,
    type ManagedProject,
} from '../services/projectService';
import { ApiError } from '../services/apiClient';
import { PageHeader } from '../components/layout/PageHeader';
import { SlidingTabPanel } from '../components/ui/SlidingTabPanel';
import { useSwipeableTabs } from '../hooks/useHorizontalWheelNavigation';
import { SpotlightCard } from '../components/ui/SpotlightCard';

export function TeamManagementPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamOverviewUser[]>([]);
    const [roles, setRoles] = useState<ProjectRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TeamManagementTab>('members');
    const [managedProjects, setManagedProjects] = useState<ManagedProject[]>([]);
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
            try {
                // The managed projects decide whether the projects tab exists
                // at all, so they are needed before the tab bar can be rendered
                // — not only once that tab is opened. A failure there must not
                // take the page down: the other two tabs do not depend on it,
                // and a manager-only endpoint answers 403 for HR.
                const [, projects] = await Promise.all([
                    loadTeamOverview(),
                    projectService.getManagedProjects().catch(() => []),
                ]);

                setManagedProjects(projects);
                setLoadError(null);
            } catch (error) {
                // Without this the page would sit on its loading text forever,
                // which looks like a blank screen rather than a failed request.
                setLoadError(
                    error instanceof ApiError
                        ? error.message
                        : 'The team overview could not be loaded.',
                );
            } finally {
                setLoading(false);
            }
        }

        void loadInitialData();
    }, [loadTeamOverview]);

    /**
     * Moving people only makes sense with somewhere to move them to, so a
     * manager with a single project never sees the projects tab.
     */
    const visibleTabs = useMemo(
        () =>
            TEAM_MANAGEMENT_TAB_ORDER.filter(
                (tab) => tab !== 'projects' || managedProjects.length > 1,
            ),
        [managedProjects.length],
    );

    // Two-finger swipe between the tabs, for people who would rather not aim
    // at the bar.
    const swipeRef = useSwipeableTabs<TeamManagementTab, HTMLElement>({
        order: visibleTabs,
        value: activeTab,
        onChange: setActiveTab,
    });

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

    // One badge for all three tabs: the number shown always belongs to whatever
    // the panel below is listing.
    const [headerCount, headerLabel] = (() => {
        switch (activeTab) {
            case 'members':
                return [filteredUsers.length, 'members'] as const;

            case 'roles':
                return [roles.length, roles.length === 1 ? 'role' : 'roles'] as const;

            default:
                return [
                    managedProjects.length,
                    managedProjects.length === 1 ? 'project' : 'projects',
                ] as const;
        }
    })();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-sm text-app-text-muted">
                    Loading team overview...
                </p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <p className="text-sm text-app-danger-text">{loadError}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Opaque and above the collapsed rail, so the rail never bleeds
                into the header area. */}
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
                                    {headerCount}
                                </div>
                                <div className="text-xs font-medium text-app-brand-text">
                                    {headerLabel}
                                </div>
                            </div>
                        }
                    />
                </div>
            </header>

            <main
                ref={swipeRef}
                className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 pt-8"
            >
                <div className="mb-6">
                    <TeamManagementTabSwitcher
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        tabs={visibleTabs}
                    />
                </div>

                <SlidingTabPanel
                    activeKey={activeTab}
                    index={visibleTabs.indexOf(activeTab)}
                >
                    {activeTab === 'members' ? (
                        <div className="min-w-0">
                            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-app-text">
                                        Team members
                                    </h2>
                                    <p className="text-sm text-app-text-muted">
                                        {filteredUsers.length} of {users.length}{' '}
                                        members shown
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
                                <SpotlightCard roundedClassName="rounded-3xl">
                                    <div className="rounded-3xl border border-app-border bg-app-surface p-8 text-center">
                                        <p className="text-sm text-app-text-muted">
                                            No team members found for this filter.
                                        </p>
                                    </div>
                                </SpotlightCard>
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
                    ) : activeTab === 'roles' ? (
                        <RoleManagementTab
                            roles={roles}
                            users={users}
                            onDataChanged={loadTeamOverview}
                        />
                    ) : (
                        <ProjectManagementTab projects={managedProjects} />
                    )}
                </SlidingTabPanel>
            </main>
        </div>
    );
}
