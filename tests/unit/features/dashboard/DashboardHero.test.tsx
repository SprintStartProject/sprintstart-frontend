import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardHero } from '../../../../src/features/dashboard/components/DashboardHero';

vi.mock('../../../../src/components/common/UserAvatar', () => ({
    UserAvatar: () => <div data-testid="mock-avatar" />,
}));

describe('DashboardHero', () => {
    const defaultProps = {
        greeting: 'Good morning',
        displayName: 'Test',
        formattedDate: 'Monday, Jan 1',
        formattedTime: '10:00 AM',
        fallbackName: 'Test',
        seed: 'test',
    };

    it('renders the greeting and user name', () => {
        render(<DashboardHero {...defaultProps} />);
        expect(screen.getByText(/Good morning/)).toBeInTheDocument();
        expect(screen.getByText(/Test/)).toBeInTheDocument();
    });
});