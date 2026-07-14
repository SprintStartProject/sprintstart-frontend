import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { SourceConnectModal } from '../../../src/features/data-ingestion/components/SourceConnectModal';
import { Activity } from 'lucide-react';
import type { SourceSystem, SourceConnectMeta } from '../../../src/features/data-ingestion/types';

describe('SourceConnectModal Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const sourceMeta: Record<SourceSystem, SourceConnectMeta> = {
            GITHUB: { name: 'GitHub', description: 'Connect to GitHub', type: 'Repository', icon: Activity },
            JIRA: { name: 'Jira', description: 'Connect to Jira', type: 'Tracker', icon: Activity },
            UPLOAD: { name: 'Upload', description: 'Upload File', type: 'File', icon: Activity }
        };
        const { baseElement } = render(
            <MemoryRouter>
                <SourceConnectModal
                    selectedSourceSystem="GITHUB"
                    sourceSystems={["GITHUB"]}
                    sourceMeta={sourceMeta}
                    owner="TestOwner"
                    repositoryName="TestRepo"
                    tokenName="TestToken"
                    tokenNames={["TestToken"]}
                    connectState="idle"
                    errorMessage={null}
                    onSourceSystemChange={vi.fn()}
                    onOwnerChange={vi.fn()}
                    onRepositoryNameChange={vi.fn()}
                    onTokenNameChange={vi.fn()}
                    onClose={vi.fn()}
                    onSubmit={vi.fn()}
                />
            </MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
