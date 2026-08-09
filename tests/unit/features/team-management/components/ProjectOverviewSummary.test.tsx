import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectOverviewSummary } from '../../../../../src/features/team-management/components/ProjectOverviewSummary';
import type { ProjectInsights } from '../../../../../src/features/team-management/useProjectInsights';
import type {
    AdminProjectDetails,
    ProjectUser,
} from '../../../../../src/services/projectService';
import type { SourceInstanceIngestionStatus } from '../../../../../src/features/data-ingestion/types';

function projectUser(id: string): ProjectUser {
    return {
        id,
        username: id,
        email: `${id}@example.com`,
        firstName: 'Max',
        lastName: 'Mustermann',
        roles: ['USER'],
        projectRoles: [],
        enabled: true,
    };
}

function project(id: string, memberIds: string[]): AdminProjectDetails {
    return {
        id,
        name: id,
        description: '',
        manager: null,
        sources: [],
        users: memberIds.map(projectUser),
    };
}

function failedSource(): SourceInstanceIngestionStatus {
    return {
        sourceSystem: 'GITHUB',
        sourceId: 'acme/widgets',
        repositoryId: 'repo-1',
        owner: 'acme',
        name: 'widgets',
        sourceUrl: 'https://github.com/acme/widgets',
        connectionStatus: 'FAILED',
        enabled: true,
        lastRunTime: null,
        ingestedCount: 0,
        updatedCount: 0,
        deletedCount: 0,
        failedCount: 3,
    } as SourceInstanceIngestionStatus;
}

const projects = [project('p1', ['u1', 'u2']), project('p2', ['u3'])];

const insights: Record<string, ProjectInsights> = {
    p1: {
        sources: [failedSource()],
        attention: [
            {
                userId: 'u1',
                hasOpenSkipRequest: true,
                hasUnreadFeedback: false,
                daysOnCurrentStep: 9,
            },
        ],
        averageProgress: 0.5,
        artifactCount: 10,
    },
    p2: {
        sources: [],
        attention: [
            {
                userId: 'u3',
                hasOpenSkipRequest: false,
                hasUnreadFeedback: true,
                daysOnCurrentStep: 1,
            },
        ],
        averageProgress: 0.7,
        artifactCount: 4,
    },
};

function summary() {
    return screen.getByRole('region', { name: 'Across all your projects' });
}

describe('ProjectOverviewSummary', () => {
    it('adds the figures up across every project', () => {
        render(
            <ProjectOverviewSummary projects={projects} insights={insights} />,
        );

        expect(within(summary()).getByText('Across 2 projects')).toBeInTheDocument();
        expect(within(summary()).getByText('3')).toBeInTheDocument();
        expect(within(summary()).getByText('members')).toBeInTheDocument();
        expect(within(summary()).getByText('waiting on you')).toBeInTheDocument();
        expect(within(summary()).getByText('60%')).toBeInTheDocument();
        expect(within(summary()).getByText('source failed')).toBeInTheDocument();
    });

    it('hides the problem counters when there is no problem', () => {
        render(
            <ProjectOverviewSummary
                projects={[projects[0]]}
                insights={{
                    p1: {
                        ...insights.p1,
                        sources: [],
                        attention: [],
                    },
                }}
            />,
        );

        expect(
            within(summary()).queryByText(/sources? failed/),
        ).not.toBeInTheDocument();
        expect(
            within(summary()).queryByText(/on one step/),
        ).not.toBeInTheDocument();
        expect(within(summary()).getByText('waiting on you')).toBeInTheDocument();
    });

    it('leaves out counters whose data never arrived', () => {
        render(
            <ProjectOverviewSummary
                projects={[projects[0]]}
                insights={{
                    p1: {
                        sources: null,
                        attention: null,
                        averageProgress: null,
                        artifactCount: null,
                    },
                }}
            />,
        );

        expect(
            within(summary()).queryByText('waiting on you'),
        ).not.toBeInTheDocument();
        expect(
            within(summary()).queryByText('average onboarding'),
        ).not.toBeInTheDocument();
        expect(within(summary()).getByText('members')).toBeInTheDocument();
    });
});
