import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '../../../src/pages/ProfilePage';

vi.mock('../../../src/context/useAuth', () => ({
    useAuth: () => ({ profile: { firstName: 'Test', username: 'Test', email: 'test@test.com' } })
}));

describe('ProfilePage Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter><main><ProfilePage /></main></MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
