import { Trash2, Users } from 'lucide-react';
import { motion, type Transition } from 'framer-motion';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { Button } from '../../../components/ui/Button';
import type { ProjectRole, Skill, TeamOverviewUser } from '../types';

/** Beyond this the avatars stop being scannable and start being a wall. */
const MAX_SHOWN_MEMBERS = 6;

type RoleCardProps = {
    role: ProjectRole;
    /** Skills of this role, already filtered and sorted by the parent. */
    skills: Skill[];
    /** The members holding this role, already filtered by the parent. */
    members: TeamOverviewUser[];
    /**
     * Chip shape: name, member count and delete only. Used for every role once
     * one of them is open, since the detail panel then says everything the
     * cards were saying.
     */
    compact: boolean;
    selected: boolean;
    transition: Transition;
    onSelect: (roleId: string) => void;
    onRequestDelete: (roleId: string) => void;
};

/**
 * One role, in either of two shapes: a card at rest, a chip once some role is
 * open. The shapes are not morphed into each other -- that was tried and
 * dropped frames on a grid of them -- the new one grows in instead.
 *
 * The whole shape is the select target, which rules out wrapping it in a button
 * -- the delete control is a button itself and cannot nest. Instead an
 * invisible button covers it and the content layer is click-through, with the
 * delete control opting back in.
 */
export function RoleCard({
    role,
    skills,
    members,
    compact,
    selected,
    transition,
    onSelect,
    onRequestDelete,
}: RoleCardProps) {
    const shownMembers = members.slice(0, MAX_SHOWN_MEMBERS);
    const hiddenMemberCount = members.length - shownMembers.length;

    // A rule only earns its place when it has something on both sides of it:
    // above an empty skill list it would just underline the members.
    const hasSkillsDivider = members.length > 0 && skills.length > 0;

    return (
        // Scale and opacity only. Growing the box by animating its layout was
        // tried and dropped frames across a grid of these; a transform runs on
        // the compositor and the column's own height animation supplies the
        // rest of the movement.
        <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={transition}
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
                        {members.length}
                    </span>
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Delete ${role.name}`}
                    onClick={() => onRequestDelete(role.id)}
                    className="pointer-events-auto shrink-0 hover:text-app-danger-text"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {!compact && (
                <div className="pointer-events-none relative flex w-full min-w-0 flex-col">
                    <p className="mt-1 flex items-center gap-1 text-xs text-app-text-muted">
                        <Users className="h-3 w-3 shrink-0" />
                        {members.length}{' '}
                        {members.length === 1 ? 'member' : 'members'}
                    </p>

                    {/* Who actually holds the role, not just how many: the
                        count alone still leaves the overview needing a click
                        per role to answer "and who is that?". Capped, because
                        a large role would otherwise push every other card off
                        the screen. */}
                    {members.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {shownMembers.map((member) => {
                                const fullName = `${member.firstname} ${member.lastname}`;

                                return (
                                    <span
                                        key={member.userId}
                                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-app-border bg-app-bg py-0.5 pl-0.5 pr-2"
                                    >
                                        <UserAvatar
                                            profileIcon={member.profileIcon}
                                            fallbackName={fullName}
                                            seed={member.userId}
                                            size={18}
                                        />
                                        <span className="truncate text-[11px] font-medium text-app-text">
                                            {fullName}
                                        </span>
                                    </span>
                                );
                            })}

                            {hiddenMemberCount > 0 && (
                                <span className="text-[11px] font-medium text-app-text-muted">
                                    +{hiddenMemberCount} more
                                </span>
                            )}
                        </div>
                    )}

                    {role.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-app-text-muted">
                            {role.description}
                        </p>
                    )}

                    <div
                        className={`mt-3 flex flex-wrap gap-1.5 ${
                            hasSkillsDivider
                                ? 'border-t border-app-border pt-3'
                                : ''
                        }`}
                    >
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
        </motion.div>
    );
}
