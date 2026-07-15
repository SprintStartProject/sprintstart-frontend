import { describe, it, expect } from 'vitest';
import { daysSince, dateBucketLabel, formatRelativeDate } from '../../../../src/features/chatbot/format';

describe('chatbot format', () => {
    describe('daysSince', () => {
        it('returns 0 for today', () => {
            expect(daysSince(new Date().toISOString())).toBe(0);
        });

        it('returns 1 for yesterday', () => {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            expect(daysSince(oneDayAgo)).toBe(1);
        });

        it('returns 0 for a missing/empty timestamp (defensive)', () => {
            expect(daysSince('')).toBe(0);
            expect(daysSince(undefined as unknown as string)).toBe(0);
        });

        it('returns 0 for an unparseable timestamp (defensive)', () => {
            expect(daysSince('not-a-date')).toBe(0);
        });
    });

    describe('dateBucketLabel', () => {
        it('returns "Today" for today', () => {
            expect(dateBucketLabel(new Date().toISOString())).toBe('Today');
        });

        it('returns "Yesterday" for 1 day ago', () => {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            expect(dateBucketLabel(oneDayAgo)).toBe('Yesterday');
        });

        it('returns "Today" for a missing timestamp (defensive)', () => {
            expect(dateBucketLabel('')).toBe('Today');
        });
    });

    describe('formatRelativeDate', () => {
        it('returns "Today" for today', () => {
            expect(formatRelativeDate(new Date().toISOString())).toBe('Today');
        });

        it('returns "5d ago" for 5 days ago', () => {
            const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatRelativeDate(fiveDaysAgo)).toBe('5d ago');
        });

        it('returns "Today" for a missing timestamp (defensive)', () => {
            expect(formatRelativeDate('')).toBe('Today');
        });
    });
});
