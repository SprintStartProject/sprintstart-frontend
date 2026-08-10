import { Badge } from '../../../../components/ui/Badge';
import type { KnowledgeGap } from '../../../knowledge-gaps/types';
import type { UserSkillLevel } from '../../../../services/teamManagementService';

type MemberGapsPanelProps = {
    skillLevels: UserSkillLevel[];
    skillGaps: UserSkillLevel[];
    knowledgeGaps: KnowledgeGap[];
    onOpenKnowledgeGap: (gapId: string) => void;
};

const LEVEL_DOTS: Record<string, number> = {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
    EXPERT: 4,
};

export function MemberGapsPanel({
    skillLevels,
    skillGaps,
    knowledgeGaps,
    onOpenKnowledgeGap,
}: MemberGapsPanelProps) {
    const skillsByRole = skillLevels.reduce<Record<string, UserSkillLevel[]>>(
        (acc, skill) => {
            const key = skill.roleName;
            if (!acc[key]) acc[key] = [];
            acc[key].push(skill);
            return acc;
        },
        {},
    );

    return (
        <>
            <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <h2 className="text-lg font-semibold text-app-text">
                    Skill Assessment
                </h2>

                {skillLevels.length === 0 ? (
                    <p className="mt-3 text-sm text-app-text-muted">
                        No completed skill assessment.
                    </p>
                ) : (
                    <div className="mt-4 space-y-4">
                        {Object.entries(skillsByRole).map(([roleName, skills]) => (
                            <div key={roleName}>
                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-app-text-muted">
                                    {roleName}
                                </p>

                                <div className="space-y-1">
                                    {skills.map((skill) => (
                                        <SkillAssessmentRow
                                            key={skill.id}
                                            skill={skill}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-app-border bg-app-surface p-6">
                <h2 className="text-lg font-semibold text-app-text">
                    Gaps
                </h2>

                <div className="mt-4 space-y-4">
                    <SkillGapsSection skillGaps={skillGaps} />

                    <KnowledgeGapsSection
                        knowledgeGaps={knowledgeGaps}
                        onOpenKnowledgeGap={onOpenKnowledgeGap}
                    />
                </div>
            </div>
        </>
    );
}

function SkillAssessmentRow({ skill }: { skill: UserSkillLevel }) {
    const filled = LEVEL_DOTS[skill.level] ?? 0;

    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface-muted px-3 py-2">
            <span className="text-sm font-medium text-app-text">
                {skill.skillName}
            </span>

            <div className="flex shrink-0 items-center gap-2">
                <div className="flex gap-1">
                    {Array.from({ length: 4 }, (_, index) => (
                        <div
                            key={index}
                            className={`h-2 w-2 rounded-full ${
                                index < filled ? 'bg-app-brand' : 'bg-app-border'
                            }`}
                        />
                    ))}
                </div>

                <span className="w-24 text-right text-xs text-app-text-muted capitalize">
                    {skill.level.toLowerCase()}
                </span>
            </div>
        </div>
    );
}

function SkillGapsSection({ skillGaps }: { skillGaps: UserSkillLevel[] }) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-app-text">
                    Skill gaps
                </p>
                <GapCountBadge count={skillGaps.length} />
            </div>

            <div className="mt-2 space-y-2">
                {skillGaps.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                        No low-rated skills found.
                    </p>
                ) : (
                    skillGaps.slice(0, 3).map((skill) => (
                        <div
                            key={skill.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-app-text">
                                    {skill.skillName}
                                </p>
                                <p className="mt-0.5 text-xs text-app-text-muted">
                                    {skill.roleName}
                                </p>
                            </div>
                            <Badge variant="warning" size="sm" className="shrink-0 capitalize">
                                {skill.level.toLowerCase()}
                            </Badge>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function KnowledgeGapsSection({
    knowledgeGaps,
    onOpenKnowledgeGap,
}: {
    knowledgeGaps: KnowledgeGap[];
    onOpenKnowledgeGap: (gapId: string) => void;
}) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-app-text">
                    Knowledge gaps
                </p>
                <GapCountBadge count={knowledgeGaps.length} />
            </div>

            <div className="mt-2 space-y-2">
                {knowledgeGaps.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                        No knowledge gaps found.
                    </p>
                ) : (
                    knowledgeGaps.map((gap) => (
                        <button
                            key={gap.id}
                            type="button"
                            onClick={() => onOpenKnowledgeGap(gap.id)}
                            className="w-full rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-left transition-colors hover:border-app-brand"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 text-sm font-medium text-app-text">
                                    {gap.component}
                                </p>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                    gap.severity === 'high'
                                        ? 'bg-app-danger-bg text-app-danger-text'
                                        : gap.severity === 'medium'
                                          ? 'bg-app-warning-bg text-app-warning-text'
                                          : 'bg-app-surface text-app-text-muted'
                                }`}>
                                    {gap.severity}
                                </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-app-text-muted">
                                {gap.missingTypes.join(', ')}
                            </p>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

function GapCountBadge({ count }: { count: number }) {
    return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            count > 0
                ? 'bg-app-warning-bg text-app-warning-text'
                : 'bg-app-success-bg text-app-success-text'
        }`}>
            {count}
        </span>
    );
}
