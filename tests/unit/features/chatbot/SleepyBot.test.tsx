import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SleepyBot } from '../../../../src/features/chatbot/components/SleepyBot';
import { announceRocketFlight } from '../../../../src/features/moments/rocketWatch';

/**
 * Ends started flights even when an assertion throws first — a leaked flight
 * would leave every later test staring at a rocket that is not there.
 */
let endFlight: (() => void) | null = null;

afterEach(() => {
    endFlight?.();
    endFlight = null;
});

function launchRocket() {
    act(() => {
        endFlight = announceRocketFlight(document.createElement('div'));
    });
}

describe('SleepyBot watching rockets', () => {
    it('gapes at a rocket for exactly as long as it flies', () => {
        render(<SleepyBot tracksPointer />);

        expect(screen.queryByTestId('bot-awe-mouth')).not.toBeInTheDocument();

        launchRocket();
        expect(screen.getByTestId('bot-awe-mouth')).toBeInTheDocument();

        act(() => {
            endFlight?.();
            endFlight = null;
        });
        expect(screen.queryByTestId('bot-awe-mouth')).not.toBeInTheDocument();
    });

    it('stays unmoved when it is not a tracking bot', () => {
        // The 30px message avatars neither track the pointer nor watch
        // rockets — at that size the whole performance is invisible detail.
        render(<SleepyBot />);

        launchRocket();
        expect(screen.queryByTestId('bot-awe-mouth')).not.toBeInTheDocument();
    });
});
