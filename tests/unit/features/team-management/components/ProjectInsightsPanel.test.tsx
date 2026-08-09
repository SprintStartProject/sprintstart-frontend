import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectInsightsPanel } from '../../../../../src/features/team-management/components/ProjectInsightsPanel';
import type { ProjectInsights } from '../../../../../src/features/team-management/useProjectInsights';
import type { SourceInstanceIngestionStatus } from '../../../../../src/features/data-ingestion/types';

function source(
    overrides: Partial<SourceInstanceIngestionStatus> = {},
): SourceInstanceIngestionStatus {
    return {
        sourceSystem: 'GITHUB',
        sourceId: 'acme/widgets',
        repositoryId: 'repo-1',
        owner: 'acme',
        name: 'widgets',
        sourceUrl: 'https://github.com/acme/widgets',
        connectionStatus: 'CONNECTED',
        enabled: true,
        lastRunTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        ingestedCount: 10,
        updatedCount: 0,
        deletedCount: 0,
        failedCount: 0,
        ...overrides,
    } as SourceInstanceIngestionStatus;
}

const insights: ProjectInsights = {
    sources: [source(), source({ repositoryId: 'repo-2', connectionStatus: 'FAILED' })],
    attention: [
        {
            userId: 'u1',
            hasOpenSkipRequest: true,
            hasUnreadFeedback: false,
            daysOnCurrentStep: 9,
        },
        {
            userId: 'u2',
            hasOpenSkipRequest: false,
            hasUnreadFeedback: true,
            daysOnCurrentStep: 1,
        },
    ],
    averageProgress: 0.62,
    artifactCount: 128,
};

describe('ProjectInsightsPanel', () => {
    it('counts what is waiting instead of naming who', () => {
        render(<ProjectInsightsPanel insights={insights} />);

        expect(screen.getByText('Open skip requests (1)')).toBeInTheDocument();
        expect(screen.getByText('Unread feedback (1)')).toBeInTheDocument();
        expect(screen.queryByText('Max Mustermann')).not.toBeInTheDocument();
    });

    it('drops a counter that is at zero', () => {
        render(
            <ProjectInsightsPanel
                insights={{
                    ...insights,
                    attention: [
                        {
                            userId: 'u1',
                            hasOpenSkipRequest: false,
                            hasUnreadFeedback: true,
                            daysOnCurrentStep: 1,
                        },
                    ],
                }}
            />,
        );

        expect(screen.getByText('Unread feedback (1)')).toBeInTheDocument();
        expect(screen.queryByText(/Open skip requests/)).not.toBeInTheDocument();
    });

    it('summarizes ingestion, progress and artifacts', () => {
        render(<ProjectInsightsPanel insights={insights} />);

        expect(screen.getByText(/1 of 2 connected/)).toBeInTheDocument();
        expect(screen.getByText('1 failed')).toBeInTheDocument();
        expect(screen.getByText('62% average')).toBeInTheDocument();
        expect(screen.getByText(/1 over 5d on one step/)).toBeInTheDocument();
        expect(screen.getByText(/128/)).toBeInTheDocument();
    });

    it('says so when nothing is waiting', () => {
        render(
            <ProjectInsightsPanel insights={{ ...insights, attention: [] }} />,
        );

        expect(screen.getByText('Nothing waiting')).toBeInTheDocument();
    });

    it('leaves out a block whose data could not be loaded', () => {
        render(
            <ProjectInsightsPanel
                insights={{
                    sources: null,
                    attention: null,
                    averageProgress: null,
                    artifactCount: null,
                }}
            />,
        );

        expect(screen.queryByText('Nothing waiting')).not.toBeInTheDocument();
        expect(screen.queryByText(/connected/)).not.toBeInTheDocument();
        expect(screen.queryByText(/average/)).not.toBeInTheDocument();
        expect(screen.queryByText(/artifact/)).not.toBeInTheDocument();
    });
});
