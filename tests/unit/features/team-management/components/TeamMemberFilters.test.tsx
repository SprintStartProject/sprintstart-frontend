import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamMemberFilters } from '../../../../../src/features/team-management/components/TeamMemberFilters';
import type { ProjectRole, TeamOverviewFilters } from '../../../../../src/features/team-management/types';

const mockRoles: ProjectRole[] = [
    { id: 'r1', name: 'Backend', description: '' },
    { id: 'r2', name: 'Frontend', description: '' },
];

const defaultFilters: TeamOverviewFilters = {
    roleId: 'all',
    sortBy: 'LONGEST_STEP',
};

describe('TeamMemberFilters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the role filter with all roles', () => {
        render(<TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={vi.fn()} />);

        const roleSelect = screen.getByRole('combobox', { name: 'Filter team members by role' });
        expect(roleSelect).toBeInTheDocument();
        expect(screen.getByText('All roles')).toBeInTheDocument();
        expect(screen.getByText('Backend')).toBeInTheDocument();
        expect(screen.getByText('Frontend')).toBeInTheDocument();
    });

    it('renders the sort-by select with sort options', () => {
        render(<TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={vi.fn()} />);

        const sortSelect = screen.getByRole('combobox', { name: 'Sort team members' });
        expect(sortSelect).toBeInTheDocument();
        expect(screen.getByText('Longest on step')).toBeInTheDocument();
        expect(screen.getByText('Shortest on step')).toBeInTheDocument();
        expect(screen.getByText('Highest progress')).toBeInTheDocument();
        expect(screen.getByText('Lowest progress')).toBeInTheDocument();
    });

    it('calls onFiltersChange with new roleId when role is changed', async () => {
        const user = userEvent.setup();
        const onFiltersChange = vi.fn();
        render(<TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={onFiltersChange} />);

        await user.selectOptions(screen.getByRole('combobox', { name: 'Filter team members by role' }), 'r1');

        expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, roleId: 'r1' });
    });

    it('calls onFiltersChange with new sortBy when sort is changed', async () => {
        const user = userEvent.setup();
        const onFiltersChange = vi.fn();
        render(<TeamMemberFilters roles={mockRoles} filters={defaultFilters} onFiltersChange={onFiltersChange} />);

        await user.selectOptions(screen.getByRole('combobox', { name: 'Sort team members' }), 'HIGHEST_PROGRESS');

        expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, sortBy: 'HIGHEST_PROGRESS' });
    });

    it('reflects the current filter values in the selects', () => {
        const filters: TeamOverviewFilters = { roleId: 'r2', sortBy: 'LOWEST_PROGRESS' };
        render(<TeamMemberFilters roles={mockRoles} filters={filters} onFiltersChange={vi.fn()} />);

        expect(screen.getByRole('combobox', { name: 'Filter team members by role' })).toHaveDisplayValue('Frontend');
        expect(screen.getByRole('combobox', { name: 'Sort team members' })).toHaveDisplayValue('Lowest progress');
    });
});
