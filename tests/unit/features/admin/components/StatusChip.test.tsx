import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from '../../../../../src/features/admin/components/StatusChip';

describe('StatusChip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the active label with the success variant when active', () => {
        render(
            <StatusChip
                active={true}
                activeLabel="Enabled"
                inactiveLabel="Disabled"
                inactiveVariant="neutral"
                inactiveKind="disabled"
            />,
        );

        const chip = screen.getByText('Enabled');
        expect(chip).toBeInTheDocument();
        expect(chip.className).toContain('bg-app-success-bg');
        expect(chip.querySelector('svg')).not.toBeNull();
    });

    it('renders the inactive label when inactive', () => {
        render(
            <StatusChip
                active={false}
                activeLabel="Enabled"
                inactiveLabel="Disabled"
                inactiveVariant="neutral"
                inactiveKind="disabled"
            />,
        );

        expect(screen.getByText('Disabled')).toBeInTheDocument();
        expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
    });

    it('uses the inactive variant when inactive', () => {
        render(
            <StatusChip
                active={false}
                activeLabel="Enabled"
                inactiveLabel="Disabled"
                inactiveVariant="danger"
                inactiveKind="disabled"
            />,
        );

        expect(screen.getByText('Disabled').className).toContain('bg-app-danger-bg');
    });

    it('uses the custom active variant when provided', () => {
        render(
            <StatusChip
                active={true}
                activeLabel="Active"
                inactiveLabel="Idle"
                activeVariant="warning"
                inactiveVariant="neutral"
                inactiveKind="pending"
            />,
        );

        expect(screen.getByText('Active').className).toContain('bg-app-warning-bg');
    });

    it('renders an icon for the disabled inactive kind', () => {
        render(
            <StatusChip
                active={false}
                activeLabel="Active"
                inactiveLabel="Disabled"
                inactiveVariant="neutral"
                inactiveKind="disabled"
            />,
        );

        const chip = screen.getByText('Disabled');
        expect(chip.querySelector('svg')).not.toBeNull();
    });

    it('renders an icon for the pending inactive kind', () => {
        render(
            <StatusChip
                active={false}
                activeLabel="Active"
                inactiveLabel="Pending"
                inactiveVariant="warning"
                inactiveKind="pending"
            />,
        );

        expect(screen.getByText('Pending').querySelector('svg')).not.toBeNull();
    });
});
