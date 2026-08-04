export type SkipRequestStatus =
    | 'PENDING'
    | 'ACCEPTED'
    | 'DENIED';

export type SkipRequest = {
    id: string;
    stepId: string;
    reason: string;
    status: SkipRequestStatus;
    reviewComment: string | null;
    reviewedAt: string | null;
};


export type TeamOverviewUser = {
    userId: string;
    firstname: string;
    lastname: string;
    profileIcon?: string;
    project: {
        id: string;
        name: string;
    };
    roles: ProjectRole[];
    skills: Skill[];
    progressPercentage: number;
    currentPhase: {
        id: string;
        title: string;
    };
    currentStep: {
        id: string;
        title: string;
        startedAt: string;
        skip: SkipRequest | null;
    } | null;
    hasFeedback: boolean;
};

export type ProjectRole = {
    id: string;
    name: string;
    description: string;
};

export type SkillLevel =
    | 'BEGINNER'
    | 'INTERMEDIATE'
    | 'ADVANCED'
    | 'EXPERT';

export type SkillStatus = 'ACTIVE' | 'RETIRED';

export type Skill = {
    id: string;
    name: string;
    roleIds: string[];
    status: SkillStatus;
    level?: SkillLevel;
};

export function isSkillLinkedToRole(skill: Skill, roleId: string): boolean {
    return skill.roleIds.includes(roleId);
}

 export type UserSkillAssessment = {
     userId: string;
     skillId: string;
     level: SkillLevel;
 };

export type TeamManagementTab = 'members' | 'roles';

/**
 * Left-to-right order of the Team Management tabs. Single source of truth:
 * `TeamManagementTabSwitcher` renders in this order and `TeamManagementPage`
 * derives the slide direction from it, so the content always travels the same
 * way the active pill does.
 */
export const TEAM_MANAGEMENT_TAB_ORDER: TeamManagementTab[] = [
    'members',
    'roles',
];

export type TeamOverviewFilters = {
    roleId: string;
    sortBy:
        | 'LONGEST_STEP'
        | 'SHORTEST_STEP'
        | 'HIGHEST_PROGRESS'
        | 'LOWEST_PROGRESS';
};
