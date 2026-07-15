import { useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { isSkillLinkedToRole } from '../types';
import type { Skill, SkillLevel, TeamOverviewUser } from '../types';

export type CreateSkillAssessmentRequest = {
    userId: string;
    skillId: string;
    level: SkillLevel;
};

type SkillSelfAssessmentWizardProps = {
    open: boolean;
    user: TeamOverviewUser;
    skills: Skill[];
    onClose: () => void;
    onSubmit: (assessments: CreateSkillAssessmentRequest[]) => Promise<void> | void;
};

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
    { value: 'BEGINNER', label: 'Beginner' },
    { value: 'INTERMEDIATE', label: 'Intermediate' },
    { value: 'ADVANCED', label: 'Advanced' },
    { value: 'EXPERT', label: 'Expert' },
];

export function SkillWizard({
    open,
    user,
    skills,
    onClose,
    onSubmit,
}: SkillSelfAssessmentWizardProps) {
    const [selectedLevels, setSelectedLevels] = useState<
        Record<string, SkillLevel>
    >({});
    const [saving, setSaving] = useState(false);

    const requiredSkills = useMemo(() => {
        const roleIds = user.roles.map((role) => role.id);

        return skills.filter(
            (skill) =>
                skill.status === 'ACTIVE' &&
                roleIds.some((roleId) => isSkillLinkedToRole(skill, roleId)),
        );
    }, [skills, user.roles]);

    const allSkillsRated =
        requiredSkills.length === 0 ||
        requiredSkills.every((skill) => selectedLevels[skill.id]);

    async function handleSubmit() {
        if (!allSkillsRated) {
            return;
        }

        const payload: CreateSkillAssessmentRequest[] = requiredSkills.map(
            (skill) => ({
                userId: user.userId,
                skillId: skill.id,
                level: selectedLevels[skill.id],
            })
        );

        setSaving(true);

        await onSubmit(payload);

        setSaving(false);
        onClose();
    }

    return (
        <Modal
            isOpen={open}
            title="Skill Self Assessment"
            description="Please rate your current level for the skills required by your assigned roles."
            size="lg"
            zIndexClassName="z-[70]"
            isDismissDisabled={saving}
            onClose={onClose}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-app-border bg-app-surface px-4 py-2.5 text-xs font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                    >
                        Later
                    </button>

                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={!allSkillsRated || saving}
                        className={`rounded-xl px-5 py-2.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                            allSkillsRated && !saving
                                ? 'bg-app-brand text-app-text-inverse shadow-lg hover:bg-app-brand-hover'
                                : 'cursor-not-allowed bg-app-surface-muted text-app-text-disabled'
                        }`}
                    >
                        {requiredSkills.length === 0 ? 'Continue' : 'Save Assessment'}
                    </button>
                </>
            }
        >
                <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                    {requiredSkills.length > 0 ? (
                        requiredSkills.map((skill) => {
                            const isRated = !!selectedLevels[skill.id];

                            return (
                                <div
                                    key={skill.id}
                                    className={`rounded-[20px] border p-4 transition-all ${
                                        isRated
                                            ? 'border-app-brand-border bg-app-brand-soft'
                                            : 'border-app-border bg-app-surface'
                                    }`}
                                >
                                    <p className="text-sm font-medium text-app-text">
                                        {skill.name}
                                    </p>

                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {SKILL_LEVELS.map((level) => (
                                            <button
                                                key={level.value}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedLevels(
                                                        (prev) => ({
                                                            ...prev,
                                                            [skill.id]:
                                                                level.value,
                                                        })
                                                    )
                                                }
                                                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
                                                    selectedLevels[skill.id] ===
                                                    level.value
                                                        ? 'border-app-brand-border-strong bg-app-brand-soft text-app-brand-text shadow-lg'
                                                        : 'border-app-border bg-app-surface text-app-text-muted hover:border-app-brand-border hover:bg-app-surface-hover hover:text-app-brand'
                                                }`}
                                            >
                                                {level.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="rounded-[20px] border border-dashed border-app-border bg-app-surface px-4 py-3 text-xs text-app-text-muted">
                            No skills found for your assigned roles.
                        </p>
                    )}
                </div>

        </Modal>
    );
}
