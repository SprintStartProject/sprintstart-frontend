import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    dismissBootSplash,
    rememberBootGreeting,
} from '../../src/bootSplash';

/** Stands in for the splash markup `index.html` paints before the bundle loads. */
function mountSplash(): HTMLElement {
    const splash = document.createElement('div');
    splash.id = 'boot-splash';
    document.body.appendChild(splash);
    return splash;
}

describe('bootSplash', () => {
    beforeEach(() => {
        document.getElementById('boot-splash')?.remove();
        delete window.__bootSplash;
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does nothing when the app renders without index.html', () => {
        // Tests and Storybook mount the app on their own page; the splash is
        // not there to be found and asking for it must not throw.
        expect(() => dismissBootSplash()).not.toThrow();
    });

    it('waits for the launch to finish before fading', () => {
        vi.useFakeTimers();
        const splash = mountSplash();

        // Ready almost immediately — a fast, warm reload.
        window.__bootSplash = { start: Date.now(), flightMs: 2000 };
        dismissBootSplash();

        // Cutting a launch off halfway reads as a glitch, so the fade holds.
        vi.advanceTimersByTime(1500);
        expect(splash).not.toHaveClass('is-ready');
        expect(splash).toBeInTheDocument();

        vi.advanceTimersByTime(600);
        expect(splash).toHaveClass('is-ready');

        vi.advanceTimersByTime(600);
        expect(document.getElementById('boot-splash')).not.toBeInTheDocument();
    });

    it('fades straight away when the launch has already played out', () => {
        vi.useFakeTimers();
        const splash = mountSplash();

        // The slow case: the flight ended long before the app was ready, and
        // the user has been reading the held frame since.
        window.__bootSplash = { start: Date.now() - 9000, flightMs: 2000 };
        dismissBootSplash();

        vi.advanceTimersByTime(0);
        expect(splash).toHaveClass('is-ready');
    });

    it('does not queue a second exit while the first one is waiting', () => {
        vi.useFakeTimers();
        const splash = mountSplash();
        window.__bootSplash = { start: Date.now(), flightMs: 2000 };

        // Auth settling can re-run the effect that calls this.
        dismissBootSplash();
        dismissBootSplash();
        dismissBootSplash();

        vi.advanceTimersByTime(3000);
        expect(document.getElementById('boot-splash')).not.toBeInTheDocument();
        expect(splash.dataset.exiting).toBe('true');
    });

    it('does not wait for the flight when the launch was for nobody', () => {
        vi.useFakeTimers();
        const splash = mountSplash();
        window.__bootSplash = { start: Date.now(), flightMs: 2000 };

        // Signed out: a login form is next, so the send-off is cut.
        dismissBootSplash('now');

        vi.advanceTimersByTime(0);
        expect(splash).toHaveClass('is-ready');
    });

    it('removes the splash instantly for the Keycloak login theme', () => {
        mountSplash();
        window.__bootSplash = { start: Date.now(), flightMs: 2000 };

        dismissBootSplash('instant');

        // Nothing was being loaded into, so there is no launch to sit through.
        expect(document.getElementById('boot-splash')).not.toBeInTheDocument();
    });

    it('remembers a first name for the next boot, and forgets it on sign-out', () => {
        rememberBootGreeting('David');
        expect(
            window.localStorage.getItem('sprintstart.boot.greeting'),
        ).toBe('David');

        rememberBootGreeting(null);
        expect(
            window.localStorage.getItem('sprintstart.boot.greeting'),
        ).toBeNull();
    });
});
