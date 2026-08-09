import { RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AlertDialog } from '../../../components/ui/AlertDialog';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import {
    createProjectRole,
    createSkill,
    deleteProjectRole,
    deleteSkill,
    getProjectRoles,
    getSkills,
    reactivateSkill,
} from '../../../services/teamManagementService';
import { isSkillLinkedToRole } from '../types';
import type { ProjectRole, Skill } from '../types';

type ProjectRolesModalProps = {
    open: boolean;
    onClose: () => void;
};

export function ProjectRolesModal({
    open,
    onClose,
}: ProjectRolesModalProps) {
    const [roles, setRoles] = useState<ProjectRole[]>([]);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedRole, setSelectedRole] = useState<ProjectRole | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillName, setSkillName] = useState('');
    const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
    const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        async function loadData() {
            const [rolesData, skillsData] = await Promise.all([
                getProjectRoles(),
                getSkills(),
            ]);

            setRoles(rolesData);
            setSkills(skillsData);
        }

        void loadData();
    }, [open]);

    async function handleCreateRole() {
        if (!roleName.trim()) return;

        const newRole = await createProjectRole(
            roleName.trim(),
            roleDescription.trim(),
        );

        setRoles((current) => [...current, newRole]);
        setSelectedRole(newRole);
        setRoleName('');
        setRoleDescription('');
    }

    async function handleCreateSkill() {
        if (!selectedRole || !skillName.trim()) return;

        const newSkill = await createSkill(
            skillName.trim(),
            [selectedRole.id],
        );

        setSkills((current) => {
            const exists = current.some((s) => s.id === newSkill.id);

            return exists
                ? current.map((s) => (s.id === newSkill.id ? newSkill : s))
                : [...current, newSkill];
        });

        setSkillName('');
    }

    async function confirmDeleteRole() {
        if (!deleteRoleId) return;

        await deleteProjectRole(deleteRoleId);

        setRoles((current) =>
            current.filter((role) => role.id !== deleteRoleId),
        );

        setSkills((current) =>
            current.map((skill) => ({
                ...skill,
                roleIds: skill.roleIds.filter((roleId) => roleId !== deleteRoleId),
            })),
        );

        if (selectedRole?.id === deleteRoleId) {
            setSelectedRole(null);
        }

        setDeleteRoleId(null);
    }

    async function handleReactivateSkill(skill: Skill) {
        const updated = await reactivateSkill(
            skill.id,
            skill.name,
            skill.roleIds,
        );

        setSkills((current) =>
            current.map((s) => (s.id === skill.id ? updated : s)),
        );
    }

    async function confirmDeleteSkill() {
        if (!deleteSkillId) return;

        await deleteSkill(deleteSkillId);

        setSkills((current) =>
            current.map((skill) =>
                skill.id === deleteSkillId
                    ? { ...skill, status: 'RETIRED' }
                    : skill,
            ),
        );

        setDeleteSkillId(null);
    }

    const selectedRoleSkills = selectedRole
        ? skills
              .filter((skill) => isSkillLinkedToRole(skill, selectedRole.id))
              .sort((first, second) =>
                  first.status === second.status
                      ? first.name.localeCompare(second.name)
                      : first.status === 'ACTIVE'
                        ? -1
                        : 1,
              )
        : [];

    const roleToDelete = roles.find((role) => role.id === deleteRoleId);
    const skillToDelete = skills.find((skill) => skill.id === deleteSkillId);

    return (
        <>
            <Modal
                isOpen={open}
                title="Project Roles"
                size="lg"
                onClose={onClose}
                footer={
                    <Button variant="secondary" onClick={onClose}>
                        Done
                    </Button>
                }
            >
                <div className="border-t border-app-border pt-6">
                    <h3 className="mb-3 text-sm font-medium text-app-text">
                        Create New Role
                    </h3>
                    <p className="mb-3 text-xs leading-relaxed text-app-text-muted">
                        Create a project role first. After that, select it below
                        to add the skills people in this role should assess.
                    </p>

                    <div className="space-y-3">
                        <input
                            value={roleName}
                            onChange={(event) =>
                                setRoleName(event.target.value)
                            }
                            placeholder="Role name"
                            className="w-full rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand-border-strong"
                        />

                        <textarea
                            value={roleDescription}
                            onChange={(event) =>
                                setRoleDescription(event.target.value)
                            }
                            placeholder="Description"
                            rows={2}
                            className="w-full resize-none rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand-border-strong"
                        />

                        <div className="flex justify-end">
                            <Button
                                variant="primary"
                                onClick={() => void handleCreateRole()}
                                disabled={!roleName.trim()}
                            >
                                Create Role
                            </Button>
                        </div>
                    </div>

                    <div className="mt-6">
                        <h3 className="mb-3 text-sm font-medium text-app-text">
                            Existing Roles
                        </h3>
                        <p className="mb-3 text-xs leading-relaxed text-app-text-muted">
                            Select a role to manage its skills.
                        </p>

                        <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                            {roles.map((role) => {
                                const isSelected =
                                    selectedRole?.id === role.id;

                                return (
                                    <div
                                        key={role.id}
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                                            isSelected
                                                ? 'border-app-brand bg-app-brand/10'
                                                : 'border-app-border bg-app-bg hover:bg-app-surface-hover'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedRole(
                                                    isSelected ? null : role,
                                                )
                                            }
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <p className="truncate text-sm font-medium text-app-text">
                                                {role.name}
                                            </p>
                                        </button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            iconOnly
                                            aria-label={`Delete ${role.name}`}
                                            onClick={() =>
                                                setDeleteRoleId(role.id)
                                            }
                                            className="hover:text-app-danger-text"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>

                        {selectedRole && (
                            <div className="mt-5 rounded-2xl border border-app-border bg-app-bg p-4">
                                <h3 className="text-sm font-semibold text-app-text">
                                    {selectedRole.name}
                                </h3>

                                {selectedRole.description && (
                                    <p className="mt-1 line-clamp-2 text-xs text-app-text-muted">
                                        {selectedRole.description}
                                    </p>
                                )}

                                <div className="mt-4">
                                    <p className="mb-2 text-xs font-medium text-app-text-muted">
                                        Skills
                                    </p>
                                    <p className="mb-3 text-xs leading-relaxed text-app-text-muted">
                                        Add skills that belong to this role.
                                        These show up in the skill assessment
                                        flow for assigned team members.
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                        {selectedRoleSkills.map((skill) => (
                                            <span
                                                key={skill.id}
                                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                                                    skill.status === 'RETIRED'
                                                        ? 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                                                        : 'border-app-border bg-app-surface text-app-text'
                                                }`}
                                            >
                                                {skill.name}

                                                {skill.status === 'RETIRED' && (
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
                                                            className="text-app-text-muted hover:text-app-success-text"
                                                        >
                                                            <RotateCcw className="h-3 w-3" />
                                                        </button>
                                                    </>
                                                )}

                                                {skill.status === 'ACTIVE' && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Retire ${skill.name}`}
                                                        onClick={() =>
                                                            setDeleteSkillId(
                                                                skill.id,
                                                            )
                                                        }
                                                        className="text-app-text-muted hover:text-app-danger-text"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}

                                        {selectedRoleSkills.length === 0 && (
                                            <p className="text-xs text-app-text-muted">
                                                No skills added yet.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <div className="min-w-0 flex-1">
                                        <input
                                            value={skillName}
                                            onChange={(event) =>
                                                setSkillName(event.target.value)
                                            }
                                            placeholder="Add skill, e.g. React"
                                            className="w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand-border-strong"
                                        />
                                    </div>

                                    <Button
                                        variant="primary"
                                        onClick={() =>
                                            void handleCreateSkill()
                                        }
                                        disabled={!skillName.trim()}
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <AlertDialog
                isOpen={Boolean(deleteRoleId || deleteSkillId)}
                title={deleteSkillId ? 'Confirm retirement' : 'Confirm deletion'}
                description={
                    <>
                        Are you sure you want to{' '}
                        {deleteSkillId ? 'retire' : 'delete'}{' '}
                        <span className="font-medium text-app-text">
                            {roleToDelete?.name ??
                                skillToDelete?.name ??
                                'this item'}
                        </span>
                        ?
                        {deleteSkillId
                            ? ' Existing assessments remain available, but the skill can no longer be assigned or assessed.'
                            : ' This action cannot be undone.'}
                    </>
                }
                confirmLabel={deleteSkillId ? 'Retire' : 'Delete'}
                variant="danger"
                onClose={() => {
                    setDeleteRoleId(null);
                    setDeleteSkillId(null);
                }}
                onConfirm={() => {
                    if (deleteRoleId) {
                        void confirmDeleteRole();
                    }

                    if (deleteSkillId) {
                        void confirmDeleteSkill();
                    }
                }}
            />
        </>
    );
}
