import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRightLeft,
  Search,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Undo2,
  UserX,
  Users,
} from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { ProjectManager } from "../../../services/projectService";
import {
  resolvePeopleDraft,
  stageAddUser,
  stageManager,
  stageToggleRemoveUser,
  type PeopleDraft,
} from "../peopleDraft";
import { matchesUserSearch, pluralize } from "../data";
import {
  canJoinMultipleProjects,
  getOtherProjectCount,
  getProjectsLeftOnMove,
  isManagerEligible,
} from "../projectMove";
import type { AdminUser, ProjectUser } from "../types";

type ProjectPeopleSectionProps = {
  /** The project being edited; decides who a staged addition would move. */
  projectId: string;
  members: ProjectUser[];
  manager: ProjectManager | null;
  availableUsers: AdminUser[];
  /** Only admins may change who manages the project. */
  canAssignManager: boolean;
  disabled?: boolean;
  snapshotKey: string;
  draft: PeopleDraft;
  onDraftChange: (draft: PeopleDraft) => void;
  /** Makes each person's name open their user details; rows are plain without it. */
  onOpenUser?: (userId: string) => void;
};

type PersonIdentity = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
};

/** Search results shown at once; the rest are reached by narrowing the search. */
const MAX_ADDABLE_USERS = 6;

/** A person in the list, whether already assigned or only staged. */
type PersonRow = {
  id: string;
  displayName: string;
  /** Identity fields, shown as `@username · email` and matched by the search box. */
  person: PersonIdentity;
  profileIcon: string | null;
  isDisabled: boolean;
  /** Other projects the person is in; only counted for roles that may be in several. */
  otherProjectCount: number;
  isManager: boolean;
  /** Whether the person may be assigned as manager (holds the PM/ADMIN role). */
  isManagerEligible: boolean;
  isPendingAdd: boolean;
  isPendingRemove: boolean;
  /** Names of the projects a staged person would be removed from on save. */
  movedFrom: string[];
};

function getDisplayName(user: {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.email ||
    "Unknown user"
  );
}

/** `@username` and email side by side, each as its own span so both stay findable. */
function PersonContact({ person, className }: { person: PersonIdentity; className?: string }) {
  return (
    <span className={["flex min-w-0 items-center gap-1.5", className].join(" ")}>
      {person.username && <span className="shrink-0">@{person.username}</span>}
      {person.username && person.email && <span aria-hidden="true">·</span>}
      {person.email && <span className="truncate">{person.email}</span>}
    </span>
  );
}

/**
 * Avatar and name block of a row. A button when the row can open the person,
 * so the whole block is one keyboard target with one accessible name instead of
 * a clickable avatar and a clickable name saying the same thing twice.
 */
function RowIdentity({
  onOpen,
  label,
  children,
}: {
  onOpen?: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!onOpen) {
    return <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

/**
 * Combined member and project-manager management for one project.
 *
 * The project manager is a member with a role rather than a separate entity, so
 * both live in one list: promoting someone is a row action, not a different
 * form. Changes are staged into the drawer's draft and saved from its footer,
 * so this component never writes to the backend itself.
 */
export function ProjectPeopleSection({
  projectId,
  members,
  manager,
  availableUsers,
  canAssignManager,
  disabled = false,
  snapshotKey,
  draft,
  onDraftChange,
  onOpenUser,
}: ProjectPeopleSectionProps) {
  const [search, setSearch] = useState("");
  const prefersReducedMotion = useReducedMotion();

  const activeDraft = resolvePeopleDraft(draft, snapshotKey);

  const effectiveManagerId =
    activeDraft.managerId === undefined ? (manager?.id ?? null) : activeDraft.managerId;

  const availableUsersById = useMemo(
    () => new Map(availableUsers.map((user) => [user.id, user])),
    [availableUsers],
  );

  const rows = useMemo<PersonRow[]>(() => {
    // Only PM and admin can be in several projects, so a count for anyone else
    // would be a leftover from before a role change rather than a fact.
    const countOtherProjects = (user: AdminUser | undefined) =>
      user && canJoinMultipleProjects(user.permissionGroup)
        ? getOtherProjectCount(user, projectId)
        : 0;

    const assigned: PersonRow[] = members.map((member) => {
      const knownUser = availableUsersById.get(member.id);

      return {
        id: member.id,
        displayName: getDisplayName(member),
        person: member,
        profileIcon: member.profileIcon ?? null,
        isDisabled: !member.enabled,
        otherProjectCount: countOtherProjects(knownUser),
        isManager: member.id === effectiveManagerId,
        isManagerEligible: isManagerEligible(...member.roles),
        isPendingAdd: false,
        isPendingRemove: activeDraft.removedUserIds.has(member.id),
        movedFrom: [],
      };
    });

    const staged: PersonRow[] = [...activeDraft.addedUserIds].flatMap((userId) => {
      const user = availableUsersById.get(userId);
      if (!user) return [];

      return [
        {
          id: user.id,
          displayName: getDisplayName(user),
          person: user,
          profileIcon: user.profileIcon ?? null,
          isDisabled: !user.enabled,
          otherProjectCount: countOtherProjects(user),
          isManager: user.id === effectiveManagerId,
          isManagerEligible: isManagerEligible(user.permissionGroup),
          isPendingAdd: true,
          isPendingRemove: false,
          movedFrom: getProjectsLeftOnMove(user, projectId).map((project) => project.name),
        },
      ];
    });

    const combined = [...assigned, ...staged];

    // The backend adds a membership row when a manager is assigned, but do not
    // rely on it: a manager missing from the member list would otherwise be
    // invisible here despite still owning the project.
    if (effectiveManagerId && !combined.some((row) => row.isManager)) {
      const knownUser = availableUsersById.get(effectiveManagerId);
      const managerUser = knownUser ?? (manager?.id === effectiveManagerId ? manager : null);

      if (managerUser) {
        combined.push({
          id: effectiveManagerId,
          displayName: getDisplayName(managerUser),
          person: managerUser,
          profileIcon: knownUser?.profileIcon ?? null,
          isDisabled: knownUser ? !knownUser.enabled : false,
          otherProjectCount: countOtherProjects(knownUser),
          isManager: true,
          // Already the manager, so eligibility is moot — treat as eligible so
          // the demote control renders normally.
          isManagerEligible: true,
          isPendingAdd: false,
          isPendingRemove: false,
          movedFrom: [],
        });
      }
    }

    // Manager first, then alphabetically — the responsible person should not
    // have to be hunted for in a long list.
    return combined.sort((a, b) => {
      if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [
    members,
    manager,
    activeDraft.addedUserIds,
    activeDraft.removedUserIds,
    availableUsersById,
    effectiveManagerId,
    projectId,
  ]);

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesUserSearch(row.person, search)),
    [rows, search],
  );

  const assignedIds = useMemo(
    () => new Set([...members.map((member) => member.id), ...activeDraft.addedUserIds]),
    [members, activeDraft.addedUserIds],
  );

  // Non-members are only offered while searching, so the list does not open
  // with every user in the system.
  const addableMatches = useMemo(() => {
    if (!search.trim()) return [];

    return availableUsers
      .filter((user) => !assignedIds.has(user.id))
      .filter((user) => matchesUserSearch(user, search));
  }, [assignedIds, availableUsers, search]);

  const addableUsers = addableMatches.slice(0, MAX_ADDABLE_USERS);

  const peopleCount = rows.filter((row) => !row.isPendingRemove).length;
  const managerCount = effectiveManagerId ? 1 : 0;

  const addUser = (userId: string) => {
    onDraftChange(stageAddUser(activeDraft, userId));
    setSearch("");
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            People
          </p>
          <p className="mt-0.5 text-sm text-app-text-muted">
            {peopleCount} {peopleCount === 1 ? "person" : "people"}
            {managerCount > 0 ? " · 1 manager" : " · no manager"}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search or add people..."
          aria-label="Search or add people"
          disabled={disabled}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {visibleRows.length > 0 && (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <li
              key={row.id}
              className={[
                "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
                row.isPendingRemove
                  ? "border-app-danger-border bg-app-danger-bg opacity-75"
                  : row.isPendingAdd
                    ? "border-app-brand-border-strong bg-app-brand-soft"
                    : "border-app-border bg-app-surface hover:-translate-y-0.5 hover:border-app-brand-border-strong hover:shadow-lg motion-reduce:hover:translate-y-0",
              ].join(" ")}
            >
              <RowIdentity
                onOpen={onOpenUser ? () => onOpenUser(row.id) : undefined}
                label={`Open ${row.displayName}`}
              >
                <UserAvatar
                  size={36}
                  profileIcon={row.profileIcon}
                  fallbackName={row.displayName}
                  seed={row.id}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        "truncate text-sm font-semibold text-app-text",
                        row.isPendingRemove ? "line-through" : "",
                      ].join(" ")}
                    >
                      {row.displayName}
                    </span>

                    {row.isManager ? (
                      <Badge variant="brand">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Manager
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Member</Badge>
                    )}
                  </span>

                  <PersonContact person={row.person} className="text-xs text-app-text-muted" />

                  {(row.isDisabled || row.otherProjectCount > 0) && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {row.isDisabled && (
                        <Badge variant="danger" size="sm">
                          <UserX className="mr-1 h-3 w-3" aria-hidden="true" />
                          Disabled
                        </Badge>
                      )}

                      {row.otherProjectCount > 0 && (
                        <span className="text-xs text-app-text-muted">
                          also in {pluralize(row.otherProjectCount, "project")}
                        </span>
                      )}
                    </span>
                  )}

                  {row.movedFrom.length > 0 && (
                    <span className="mt-1 flex items-start gap-1 text-xs font-medium text-app-warning-text">
                      <ArrowRightLeft className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>Will be moved from {row.movedFrom.join(", ")}</span>
                    </span>
                  )}
                </span>
              </RowIdentity>

              <span className="flex shrink-0 items-center gap-1">
                {canAssignManager &&
                  (row.isManager ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={() => onDraftChange(stageManager(activeDraft, null))}
                      disabled={disabled}
                      aria-label={`Remove ${row.displayName} as project manager`}
                      title="Remove as manager"
                      className="text-app-brand"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                  ) : (
                    !row.isPendingRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => onDraftChange(stageManager(activeDraft, row.id))}
                        disabled={disabled || !row.isManagerEligible}
                        aria-label={
                          row.isManagerEligible
                            ? `Make ${row.displayName} project manager`
                            : `Make ${row.displayName} project manager — requires the Project Manager (PM) role`
                        }
                        title={
                          row.isManagerEligible
                            ? "Make manager"
                            : "User needs the Project Manager (PM) role first"
                        }
                        className="hover:text-app-brand"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                    )
                  ))}

                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onDraftChange(stageToggleRemoveUser(activeDraft, row.id))}
                  disabled={disabled || (row.isManager && !row.isPendingRemove)}
                  aria-label={
                    row.isPendingRemove
                      ? `Keep ${row.displayName} in project`
                      : `Remove ${row.displayName} from project`
                  }
                  title={
                    row.isManager && !row.isPendingRemove ? "Remove as manager first" : undefined
                  }
                  className="hover:bg-app-danger-bg hover:text-app-danger-text"
                >
                  {row.isPendingRemove ? (
                    <Undo2 className="h-4 w-4" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* The empty-state box speaks for the whole list, so it only stands in
          when nothing matches at all — never above a valid "Add to project"
          result that the search just surfaced. */}
      {visibleRows.length === 0 && addableUsers.length === 0 && (
        <p className="rounded-2xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-app-text-muted">
          {search.trim()
            ? `No people match "${search.trim()}".`
            : "Nobody is assigned to this project yet."}
        </p>
      )}

      {addableUsers.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-app-text-muted uppercase">
            Add to project
          </p>

          <ul className="space-y-1">
            {addableUsers.map((user, addableIndex) => (
              <motion.li
                key={user.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.2, delay: addableIndex * 0.04, ease: "easeOut" }
                }
              >
                <button
                  type="button"
                  onClick={() => addUser(user.id)}
                  disabled={disabled}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserAvatar
                    size={32}
                    profileIcon={user.profileIcon}
                    fallbackName={getDisplayName(user)}
                    seed={user.id}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-app-text">
                      {getDisplayName(user)}
                    </span>
                    <PersonContact person={user} className="text-xs text-app-text-muted" />
                  </span>
                  <UserPlus className="h-4 w-4 shrink-0 text-app-text-muted" />
                </button>
              </motion.li>
            ))}
          </ul>

          {addableMatches.length > addableUsers.length && (
            <p className="mt-2 px-3 text-xs text-app-text-muted">
              Showing {addableUsers.length} of {addableMatches.length}. Refine your search to see
              more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
