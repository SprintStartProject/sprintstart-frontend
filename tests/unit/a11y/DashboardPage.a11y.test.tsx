import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../../src/pages/DashboardPage';

vi.mock('../../../src/context/useAuth', () => ({
    // `projectRoles` is not optional on `UserProfile`, and the access policy
    // reads it while rendering — a partial fake here takes the whole tree down
    // rather than failing an assertion.
    useAuth: () => ({
        profile: {
            firstName: 'Test',
            username: 'Test',
            email: 'test@test.com',
            projectRoles: [],
            projectIds: [],
            hasCompletedOnboarding: false,
        },
    }),
}));

describe('DashboardPage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><DashboardPage /></MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
