import { Check, ChevronDown, ChevronRight, Settings, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { ProjectRolesModal } from './ProjectRolesModal';
import { getProjectRoles, getSkills } from '../../../services/teamManagementService';
import { isSkillLinkedToRole } from '../types';
import type { ProjectRole, Skill } from '../types';

type RolesSkillsPanelProps = {
    /** Role currently in "assign mode" (members become clickable to select
     * them for this role), or null when no assignment is in progress. */
    assigningRoleId: string | null;
    /** Number of members currently selected for the active assignment
     * (pre-filled with members who already have the role). */
    selectedCount: number;
    /** Whether the current selection differs from who already had the role,
     * i.e. there is something to save. */
    hasChanges: boolean;
    /** True while the bulk assignment request is in flight. */
    assigning: boolean;
    onStartAssign: (roleId: string) => void;
    onCancelAssign: () => void;
    onConfirmAssign: () => void;
};

export function RolesSkillsPanel({
    assigningRoleId,
    selectedCount,
    hasChanges,
    assigning,
    onStartAssign,
    onCancelAssign,
    onConfirmAssign,
}: RolesSkillsPanelProps) {
    const [roles, setRoles] = useState<ProjectRole[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
    const [rolesModalOpen, setRolesModalOpen] = useState(false);

    useEffect(() => {
        async function loadData() {
            const [rolesData, skillsData] = await Promise.all([
                getProjectRoles(),
                getSkills(),
            ]);

            setRoles(rolesData);
            setSkills(skillsData);
        }

        void loadData();
    }, []);

    async function reloadRolesAndSkills() {
        const [rolesData, skillsData] = await Promise.all([
            getProjectRoles(),
            getSkills(),
        ]);

        setRoles(rolesData);
        setSkills(skillsData);
    }

    function handleRoleClick(roleId: string) {
        setExpandedRoleId((current) => (current === roleId ? null : roleId));
    }

    return (
        <>
            <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-app-text">
                        Roles &amp; skills
                    </h3>

                    <button
                        type="button"
                        onClick={() => setRolesModalOpen(true)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1 text-xs text-app-text-muted transition-colors hover:border-app-brand-border-strong hover:text-app-text"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Manage
                    </button>
                </div>

                <p className="mb-3 text-xs leading-relaxed text-app-text-muted">
                    {assigningRoleId
                        ? `Members who already have this role are pre-selected. Click members on the left to add or remove them, then confirm — ${selectedCount} selected.`
                        : 'Click the assign icon on a role to add or remove members.'}
                </p>

                <div className="space-y-2">
                    {roles.map((role) => {
                        const isExpanded = expandedRoleId === role.id;
                        const isAssigning = assigningRoleId === role.id;
                        const roleSkills = skills.filter(
                            (skill) =>
                                skill.status === 'ACTIVE' &&
                                isSkillLinkedToRole(skill, role.id),
                        );

                        return (
                            <div
                                key={role.id}
                                className={`rounded-xl border transition-colors ${
                                    isAssigning
                                        ? 'border-app-brand bg-app-brand-soft'
                                        : 'border-app-border bg-app-surface'
                                }`}
                            >
                                <div className="flex items-center gap-1 px-2 py-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleRoleClick(role.id)}
                                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
                                        ) : (
                                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
                                        )}
                                        <span className="truncate text-sm font-medium text-app-text">
                                            {role.name}
                                        </span>
                                    </button>

                                    {isAssigning ? (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <span className="text-xs font-medium text-app-brand-text">
                                                {selectedCount}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={onConfirmAssign}
                                                disabled={!hasChanges || assigning}
                                                aria-label={`Save ${role.name} assignment changes`}
                                                className="rounded-lg p-1 text-app-brand transition-colors hover:bg-app-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={onCancelAssign}
                                                disabled={assigning}
                                                aria-label="Cancel assignment"
                                                className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onStartAssign(role.id)}
                                            aria-label={`Assign ${role.name} to members`}
                                            className="shrink-0 rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-brand-soft hover:text-app-brand-text"
                                        >
                                            <UserPlus className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                {isExpanded && !isAssigning && (
                                    <div className="border-t border-app-border px-3 py-2.5">
                                        {role.description && (
                                            <p className="mb-2 text-xs text-app-text-muted">
                                                {role.description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-1.5">
                                            {roleSkills.map((skill) => (
                                                <Badge
                                                    key={skill.id}
                                                    variant="neutral"
                                                    className="px-2.5 py-1"
                                                >
                                                    {skill.name}
                                                </Badge>
                                            ))}

                                            {roleSkills.length === 0 && (
                                                <p className="text-xs text-app-text-muted">
                                                    No skills added yet.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {roles.length === 0 && (
                        <p className="text-xs text-app-text-muted">
                            No roles yet. Use &quot;Manage&quot; to create one.
                        </p>
                    )}
                </div>
            </div>

            <ProjectRolesModal
                open={rolesModalOpen}
                onClose={() => {
                    setRolesModalOpen(false);
                    void reloadRolesAndSkills();
                }}
            />
        </>
    );
}
