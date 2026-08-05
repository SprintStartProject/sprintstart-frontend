import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Plug } from 'lucide-react';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { Badge } from '../../../components/ui/Badge';
import { FilterSelect } from '../../../components/ui/FilterSelect';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { ApiError } from '../../../services/apiClient';
import {
    projectService,
    type AdminProjectDetails,
    type ManagedProject,
    type ProjectSource,
    type ProjectUser,
} from '../../../services/projectService';

/** A move the user has picked but not confirmed yet. */
type PendingMove = {
    user: ProjectUser;
    sourceProject: AdminProjectDetails;
    targetProject: AdminProjectDetails;
};

type ProjectManagementTabProps = {
    /**
     * The projects the caller manages, already loaded by the page so the tab
     * does not repeat the request the page needed to decide whether to show
     * this tab at all. Only ever rendered with two or more.
     */
    projects: ManagedProject[];
};

/** Sources connected to a project, coloured by how healthy they are. */
function sourceVariant(status: ProjectSource['status']) {
    switch (status) {
        case 'CONNECTED':
            return 'success' as const;

        case 'FAILED':
        case 'ERROR':
            return 'danger' as const;

        case 'DISABLED':
        case 'DISCONNECTED':
            return 'neutral' as const;

        default:
            return 'warning' as const;
    }
}

/**
 * Lets a project manager move their people between the projects they manage.
 *
 * Grouped by project rather than shown as one flat member list: a manager reads
 * this page per project ("who is on Alpha, what is connected to it"), and the
 * move is the exception, not the main axis. Each project therefore leads with
 * its own description, roles in use and connected sources, and the member rows
 * follow underneath.
 *
 * The manager is pulled out of the member list and rendered as a highlighted
 * row of its own — they are the one person here who cannot be moved, so showing
 * them like any other member would only invite an action that ends in a 409.
 *
 * Adding and removing members stays with administrators, so this tab never
 * offers either; a manager may only change which of their projects someone is
 * in.
 */
export function ProjectManagementTab({ projects }: ProjectManagementTabProps) {
    const [details, setDetails] = useState<AdminProjectDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
    const [moving, setMoving] = useState(false);
    const [moveError, setMoveError] = useState<string | undefined>(undefined);

    const projectIds = useMemo(
        () => projects.map((project) => project.id).join(','),
        [projects],
    );

    const load = useCallback(async () => {
        // One request per project rather than a bulk endpoint: `/projects/{id}`
        // is the only route that gives a manager the sources and project roles
        // as well, and a manager runs a handful of projects at most.
        const loaded = await Promise.all(
            projectIds
                .split(',')
                .map((projectId) => projectService.getAccessibleProject(projectId)),
        );

        setDetails(loaded);
    }, [projectIds]);

    useEffect(() => {
        let active = true;

        async function loadInitialData() {
            try {
                await load();
                if (active) setLoadError(null);
            } catch (error) {
                if (!active) return;
                setLoadError(
                    error instanceof ApiError
                        ? error.message
                        : 'Projects could not be loaded.',
                );
            } finally {
                if (active) setLoading(false);
            }
        }

        void loadInitialData();

        return () => {
            active = false;
        };
    }, [load]);

    const projectOptions = useMemo(
        () => details.map(({ id, name }) => ({ value: id, label: name })),
        [details],
    );

    /**
     * Biggest project first, so the two-column grid puts the one with the most
     * people on the left. Name breaks ties, otherwise two equally sized
     * projects would swap sides on every reload.
     */
    const orderedProjects = useMemo(
        () =>
            [...details].sort(
                (a, b) =>
                    b.users.length - a.users.length ||
                    a.name.localeCompare(b.name),
            ),
        [details],
    );

    const requestMove = useCallback(
        (
            user: ProjectUser,
            sourceProject: AdminProjectDetails,
            targetProjectId: string,
        ) => {
            if (targetProjectId === sourceProject.id) return;

            const targetProject = details.find(
                (project) => project.id === targetProjectId,
            );
            if (!targetProject) return;

            setMoveError(undefined);
            setPendingMove({ user, sourceProject, targetProject });
        },
        [details],
    );

    const confirmMove = useCallback(async () => {
        if (!pendingMove) return;

        setMoving(true);
        setMoveError(undefined);

        try {
            await projectService.transferProjectUser(
                pendingMove.targetProject.id,
                {
                    userId: pendingMove.user.id,
                    sourceProjectId: pendingMove.sourceProject.id,
                },
            );
            // Reloaded rather than patched locally: the move carries the project
            // roles over, and the server is the only thing that knows what both
            // member lists look like afterwards.
            await load();
            setPendingMove(null);
        } catch (error) {
            setMoveError(
                error instanceof ApiError
                    ? error.message
                    : 'The member could not be moved.',
            );
        } finally {
            setMoving(false);
        }
    }, [load, pendingMove]);

    if (loading) {
        return (
            <div className="rounded-3xl border border-app-border bg-app-surface p-8 text-center">
                <p className="text-sm text-app-text-muted">
                    Loading your projects...
                </p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-3xl border border-app-danger-border bg-app-surface p-8 text-center">
                <p className="text-sm text-app-danger">{loadError}</p>
            </div>
        );
    }

    return (
        // `items-start` so a short project card does not stretch to the height
        // of a long one next to it.
        <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {orderedProjects.map((project) => {
                const managerId = project.manager?.id;
                const members = project.users
                    .filter((user) => user.id !== managerId)
                    .sort((a, b) =>
                        fullName(a).localeCompare(fullName(b)),
                    );
                const rolesInUse = [
                    ...new Set(
                        project.users.flatMap((user) => user.projectRoles),
                    ),
                ].sort();

                return (
                    <section
                        key={project.id}
                        aria-labelledby={`project-${project.id}-heading`}
                        className="rounded-3xl border border-app-border bg-app-surface p-5"
                    >
                        <div className="mb-4 border-b border-app-border pb-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3
                                    id={`project-${project.id}-heading`}
                                    className="text-base font-semibold text-app-text"
                                >
                                    {project.name}
                                </h3>
                                <span className="text-xs text-app-text-muted">
                                    {project.users.length}{' '}
                                    {project.users.length === 1
                                        ? 'member'
                                        : 'members'}
                                </span>
                            </div>

                            {project.description && (
                                <p className="mt-1 text-sm text-app-text-muted">
                                    {project.description}
                                </p>
                            )}

                            <dl className="mt-4 flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <dt className="text-xs font-medium uppercase tracking-wide text-app-text-muted">
                                        Roles
                                    </dt>
                                    <dd className="flex flex-wrap gap-2">
                                        {rolesInUse.length === 0 ? (
                                            <span className="text-sm text-app-text-muted">
                                                None assigned yet
                                            </span>
                                        ) : (
                                            rolesInUse.map((role) => (
                                                <Badge
                                                    key={role}
                                                    variant="neutral"
                                                >
                                                    {role}
                                                </Badge>
                                            ))
                                        )}
                                    </dd>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <dt className="text-xs font-medium uppercase tracking-wide text-app-text-muted">
                                        Sources
                                    </dt>
                                    <dd className="flex flex-wrap gap-2">
                                        {project.sources.length === 0 ? (
                                            <span className="text-sm text-app-text-muted">
                                                Nothing connected
                                            </span>
                                        ) : (
                                            project.sources.map((source) => (
                                                <Badge
                                                    key={source.id}
                                                    variant={sourceVariant(
                                                        source.status,
                                                    )}
                                                >
                                                    <Plug
                                                        className="mr-1.5 h-3 w-3"
                                                        aria-hidden="true"
                                                    />
                                                    {source.name}
                                                </Badge>
                                            ))
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {project.manager && (
                            <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-app-brand-border bg-app-brand-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <UserAvatar
                                        fallbackName={fullName(project.manager)}
                                        seed={project.manager.id}
                                        size={36}
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-app-brand-text">
                                            {fullName(project.manager)}
                                        </p>
                                        <p className="truncate text-xs text-app-brand-text/80">
                                            {project.manager.email}
                                        </p>
                                    </div>
                                </div>

                                <Badge variant="brand" className="self-start">
                                    <Crown
                                        className="mr-1.5 h-3 w-3"
                                        aria-hidden="true"
                                    />
                                    Project manager
                                </Badge>
                            </div>
                        )}

                        {members.length === 0 ? (
                            <p className="px-1 py-3 text-sm text-app-text-muted">
                                No other members in this project.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {members.map((user) => (
                                    <li
                                        key={user.id}
                                        className="flex flex-col gap-3 rounded-2xl border border-app-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <UserAvatar
                                                profileIcon={user.profileIcon}
                                                fallbackName={fullName(user)}
                                                seed={user.id}
                                                size={36}
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-app-text">
                                                    {fullName(user)}
                                                </p>
                                                <p className="truncate text-xs text-app-text-muted">
                                                    {user.email}
                                                </p>
                                                {user.projectRoles.length >
                                                    0 && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {user.projectRoles.map(
                                                            (role) => (
                                                                <Badge
                                                                    key={role}
                                                                    variant="neutral"
                                                                >
                                                                    {role}
                                                                </Badge>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <FilterSelect
                                            label={`Move ${fullName(user)} to another project`}
                                            value={project.id}
                                            options={projectOptions}
                                            onChange={(targetProjectId) =>
                                                requestMove(
                                                    user,
                                                    project,
                                                    targetProjectId,
                                                )
                                            }
                                            className="sm:w-60"
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}

            <AlertDialog
                isOpen={pendingMove !== null}
                title="Move member?"
                description={
                    pendingMove ? (
                        <>
                            <strong>{fullName(pendingMove.user)}</strong> moves
                            from{' '}
                            <strong>{pendingMove.sourceProject.name}</strong> to{' '}
                            <strong>{pendingMove.targetProject.name}</strong>.
                            Their project roles move along.
                        </>
                    ) : undefined
                }
                confirmLabel="Move"
                isLoading={moving}
                loadingLabel="Moving..."
                errorMessage={moveError}
                onClose={() => {
                    setPendingMove(null);
                    setMoveError(undefined);
                }}
                onConfirm={() => void confirmMove()}
            />
        </div>
    );
}

/** Display name, falling back to the username when a name is missing. */
function fullName(person: {
    firstName: string;
    lastName: string;
    username: string;
}): string {
    return `${person.firstName} ${person.lastName}`.trim() || person.username;
}
