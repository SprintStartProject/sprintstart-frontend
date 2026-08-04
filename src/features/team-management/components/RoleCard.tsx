import { Trash2, Users } from 'lucide-react';
import type { ProjectRole, Skill } from '../types';

type RoleCardProps = {
    role: ProjectRole;
    /** Skills of this role, already filtered and sorted by the parent. */
    skills: Skill[];
    memberCount: number;
    /**
     * Chip shape: name, member count and delete only. Used for every role once
     * one of them is open, since the detail panel then says everything the
     * cards were saying.
     */
    compact: boolean;
    selected: boolean;
    onSelect: (roleId: string) => void;
    onRequestDelete: (roleId: string) => void;
};

/**
 * One role, in either of two shapes: a card at rest, a chip once some role is
 * open. The switch is deliberately instant -- morphing the two shapes was tried
 * and dropped frames on a grid of them.
 *
 * The whole shape is the select target, which rules out wrapping it in a button
 * -- the delete control is a button itself and cannot nest. Instead an
 * invisible button covers it and the content layer is click-through, with the
 * delete control opting back in.
 */
export function RoleCard({
    role,
    skills,
    memberCount,
    compact,
    selected,
    onSelect,
    onRequestDelete,
}: RoleCardProps) {
    return (
        <div
            className={`group relative flex transition-colors ${
                compact
                    ? 'max-w-full items-center gap-1 rounded-xl border px-2 py-1.5'
                    : 'flex-col rounded-2xl border p-4 hover:shadow-lg'
            } ${
                selected
                    ? 'border-app-brand bg-app-brand-soft'
                    : 'border-app-border bg-app-surface hover:border-app-brand-border-strong hover:bg-app-surface-hover'
            }`}
        >
            <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(role.id)}
                className={`absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                    compact ? 'rounded-xl' : 'rounded-2xl'
                }`}
            >
                <span className="sr-only">
                    {selected
                        ? `Close ${role.name}`
                        : `Manage skills and members of ${role.name}`}
                </span>
            </button>

            <div className="pointer-events-none relative flex w-full min-w-0 items-center gap-2">
                <span
                    className={`min-w-0 flex-1 truncate text-sm text-app-text ${
                        compact ? 'font-medium' : 'font-semibold'
                    }`}
                >
                    {role.name}
                </span>

                {compact && (
                    <span
                        className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                            selected
                                ? 'bg-app-brand/20 text-app-brand-text'
                                : 'bg-app-bg text-app-text-subtle'
                        }`}
                    >
                        {memberCount}
                    </span>
                )}

                <button
                    type="button"
                    aria-label={`Delete ${role.name}`}
                    onClick={() => onRequestDelete(role.id)}
                    className="pointer-events-auto shrink-0 rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-danger-text"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            {!compact && (
                <div className="pointer-events-none relative flex w-full min-w-0 flex-col">
                    <p className="mt-1 flex items-center gap-1 text-xs text-app-text-muted">
                        <Users className="h-3 w-3 shrink-0" />
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </p>

                    {role.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-app-text-muted">
                            {role.description}
                        </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {skills.map((skill) => (
                            <span
                                key={skill.id}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                                    skill.status === 'RETIRED'
                                        ? 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                                        : 'border-app-border bg-app-bg text-app-text'
                                }`}
                            >
                                {skill.name}

                                {/* Read-only here on purpose: retiring a skill
                                    belongs to the open role, where the panel
                                    also offers adding one. */}
                                {skill.status === 'RETIRED' && (
                                    <span className="font-medium">Retired</span>
                                )}
                            </span>
                        ))}

                        {skills.length === 0 && (
                            <p className="text-xs text-app-text-muted">
                                No skills yet.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
