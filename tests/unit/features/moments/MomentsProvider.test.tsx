import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MomentsProvider } from '../../../../src/features/moments/MomentsProvider';
import { useMoments } from '../../../../src/features/moments/useMoments';
import type { AuthStatus } from '../../../../src/context/AuthContext';

/** Only the slice of the auth context that `MomentsProvider` actually reads. */
interface MockAuthValue {
    status: AuthStatus;
    profile: { firstName: string } | null;
}

const mockAuth = vi.hoisted(() => {
    const state: { value: MockAuthValue } = {
        value: { status: 'authenticated', profile: { firstName: 'Test' } },
    };
    return state;
});

vi.mock('../../../../src/context/useAuth', () => ({
    useAuth: () => mockAuth.value,
}));


/** Minimal consumer that queues celebrations on demand. */
function Trigger() {
    const { celebrate } = useMoments();
    return (
        <>
            <button
                onClick={() =>
                    celebrate({
                        tone: 'milestone',
                        title: 'Phase cleared',
                        message: 'The next phase is unlocked.',
                    })
                }
            >
                first
            </button>
            <button
                onClick={() =>
                    celebrate({
                        tone: 'triumph',
                        title: 'All done',
                        message: 'Every phase is behind you.',
                    })
                }
            >
                second
            </button>
        </>
    );
}

describe('MomentsProvider', () => {
    beforeEach(() => {
        mockAuth.value = {
            status: 'authenticated',
            profile: { firstName: 'Test' },
        };
    });

    it('throws when useMoments is used outside the provider', () => {
        // React logs the thrown error; silence it so the run stays readable.
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Trigger />)).toThrow(
            /useMoments must be used within a MomentsProvider/,
        );
        spy.mockRestore();
    });

    it('shows a queued celebration and dismisses it', async () => {
        const user = userEvent.setup();
        render(
            <MomentsProvider>
                <Trigger />
            </MomentsProvider>,
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(screen.getByText('first'));

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveAccessibleName('Phase cleared');
        expect(screen.getByText('The next phase is unlocked.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Keep going' }));

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
    });

    it('queues celebrations instead of stacking them', async () => {
        const user = userEvent.setup();
        render(
            <MomentsProvider>
                <Trigger />
            </MomentsProvider>,
        );

        await user.click(screen.getByText('first'));
        await user.click(screen.getByText('second'));

        // Only the first is on screen; the second waits its turn.
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(await screen.findByText('Phase cleared')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Keep going' }));

        expect(await screen.findByText('All done')).toBeInTheDocument();
    });

    it('plays the launch sequence on every page load', () => {
        render(
            <MomentsProvider>
                <span>app</span>
            </MomentsProvider>,
        );

        expect(screen.getByText('SprintStart')).toBeInTheDocument();
    });

    it('plays while auth is still resolving, so the app boots behind it', () => {
        mockAuth.value = { status: 'loading', profile: null };

        render(
            <MomentsProvider>
                <span>app</span>
            </MomentsProvider>,
        );

        expect(screen.getByText('SprintStart')).toBeInTheDocument();
        // The app is mounted underneath the whole time, never gated by it.
        expect(screen.getByText('app')).toBeInTheDocument();
    });

    it('stays off the login screen', () => {
        mockAuth.value = { status: 'unauthenticated', profile: null };

        render(
            <MomentsProvider>
                <span>app</span>
            </MomentsProvider>,
        );

        expect(screen.queryByText('SprintStart')).not.toBeInTheDocument();
    });

    it('stops the sequence if auth resolves to signed out mid-flight', () => {
        const { rerender } = render(
            <MomentsProvider>
                <span>app</span>
            </MomentsProvider>,
        );
        expect(screen.getByText('SprintStart')).toBeInTheDocument();

        mockAuth.value = { status: 'unauthenticated', profile: null };
        rerender(
            <MomentsProvider>
                <span>app</span>
            </MomentsProvider>,
        );

        expect(screen.queryByText('SprintStart')).not.toBeInTheDocument();
    });

});
