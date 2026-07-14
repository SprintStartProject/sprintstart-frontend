import { describe, it, expect } from 'vitest';
import {
    SOURCE_SYSTEMS,
    SOURCE_META,
    INGESTION_RUN_LIMIT,
    DETAILS_RUN_LIMIT,
    createDataSource,
    getSourceStatus,
    getSourceStatusLabel,
    getRunStatusLabel,
    getRunStatusTone,
    isRunInProgress,
    getSourceLabel,
    formatDateTime,
    formatRunFinishedAt,
    formatNumber,
} from '../../../../src/features/data-ingestion/data';
import type {
    IngestionRunStatus,
    SourceIngestionStatus,
} from '../../../../src/features/data-ingestion/types';

describe('data-ingestion data helpers', () => {
    describe('SOURCE_SYSTEMS / SOURCE_META', () => {
        it('lists all known source systems', () => {
            expect(SOURCE_SYSTEMS).toEqual(['GITHUB', 'JIRA', 'UPLOAD']);
        });

        it('provides meta for every source system', () => {
            for (const sys of SOURCE_SYSTEMS) {
                expect(SOURCE_META[sys].name).toBeTruthy();
                expect(SOURCE_META[sys].type).toBeTruthy();
                expect(SOURCE_META[sys].icon).toBeDefined();
                expect(SOURCE_META[sys].description).toBeTruthy();
            }
        });
    });

    describe('limits', () => {
        it('exports sensible positive limits', () => {
            expect(INGESTION_RUN_LIMIT).toBeGreaterThan(0);
            expect(DETAILS_RUN_LIMIT).toBeGreaterThan(0);
        });
    });

    describe('isRunInProgress', () => {
        it('returns true for CONNECTED and RUNNING', () => {
            expect(isRunInProgress('CONNECTED')).toBe(true);
            expect(isRunInProgress('RUNNING')).toBe(true);
        });

        it('returns false for terminal statuses', () => {
            expect(isRunInProgress('COMPLETED')).toBe(false);
            expect(isRunInProgress('PARTIAL')).toBe(false);
            expect(isRunInProgress('FAILED')).toBe(false);
        });

        it('returns false for null/undefined', () => {
            expect(isRunInProgress(null)).toBe(false);
            expect(isRunInProgress(undefined)).toBe(false);
        });
    });

    describe('getSourceStatus', () => {
        it('returns warning when the source has never synced', () => {
            expect(getSourceStatus(true, false, 'COMPLETED')).toBe('warning');
        });

        it('returns running when a run is in progress', () => {
            expect(getSourceStatus(false, false, 'RUNNING')).toBe('running');
            expect(getSourceStatus(false, false, 'CONNECTED')).toBe('running');
        });

        it('returns warning for FAILED and PARTIAL run statuses', () => {
            expect(getSourceStatus(false, false, 'FAILED')).toBe('warning');
            expect(getSourceStatus(false, false, 'PARTIAL')).toBe('warning');
        });

        it('returns warning when there are errors regardless of status', () => {
            expect(getSourceStatus(false, true, 'COMPLETED')).toBe('warning');
        });

        it('returns connected for a clean completed run', () => {
            expect(getSourceStatus(false, false, 'COMPLETED')).toBe('connected');
        });
    });

    describe('getSourceStatusLabel', () => {
        it('labels the never-synced state', () => {
            expect(getSourceStatusLabel(true, false, null)).toBe('Not synced');
        });

        it('labels the running state', () => {
            expect(getSourceStatusLabel(false, false, 'RUNNING')).toBe('Running');
        });

        it('labels FAILED and PARTIAL', () => {
            expect(getSourceStatusLabel(false, false, 'FAILED')).toBe('Failed');
            expect(getSourceStatusLabel(false, false, 'PARTIAL')).toBe('Partial');
        });

        it('labels the error-warning state', () => {
            expect(getSourceStatusLabel(false, true, 'COMPLETED')).toBe('Warning');
        });

        it('labels COMPLETED as Synced', () => {
            expect(getSourceStatusLabel(false, false, 'COMPLETED')).toBe('Synced');
        });

        it('defaults to Connected for a clean connected status without errors', () => {
            expect(getSourceStatusLabel(false, false, 'COMPLETED')).toBe('Synced');
        });
    });

    describe('getRunStatusLabel', () => {
        it('returns Running for CONNECTED and RUNNING', () => {
            expect(getRunStatusLabel('CONNECTED')).toBe('Running');
            expect(getRunStatusLabel('RUNNING')).toBe('Running');
        });

        it('returns Success for COMPLETED', () => {
            expect(getRunStatusLabel('COMPLETED')).toBe('Success');
        });

        it('returns Partial and Failed for those statuses', () => {
            expect(getRunStatusLabel('PARTIAL')).toBe('Partial');
            expect(getRunStatusLabel('FAILED')).toBe('Failed');
        });
    });

    describe('getRunStatusTone', () => {
        it('returns success for COMPLETED', () => {
            expect(getRunStatusTone('COMPLETED')).toBe('success');
        });

        it('returns running for in-progress statuses', () => {
            expect(getRunStatusTone('RUNNING')).toBe('running');
            expect(getRunStatusTone('CONNECTED')).toBe('running');
        });

        it('returns warning for FAILED and PARTIAL', () => {
            expect(getRunStatusTone('FAILED')).toBe('warning');
            expect(getRunStatusTone('PARTIAL')).toBe('warning');
        });
    });

    describe('getSourceLabel', () => {
        it('returns the meta type for a source system', () => {
            expect(getSourceLabel('GITHUB')).toBe(SOURCE_META.GITHUB.type);
            expect(getSourceLabel('JIRA')).toBe(SOURCE_META.JIRA.type);
        });
    });

    describe('formatDateTime', () => {
        it('returns "Never" for null', () => {
            expect(formatDateTime(null)).toBe('Never');
        });

        it('passes through unparseable values', () => {
            expect(formatDateTime('not-a-date')).toBe('not-a-date');
        });

        it('formats a valid ISO timestamp', () => {
            const result = formatDateTime('2026-07-05T10:00:00Z');
            expect(result).not.toBe('Never');
            expect(result).toContain('2026');
        });
    });

    describe('formatRunFinishedAt', () => {
        it('returns the formatted timestamp when present', () => {
            const result = formatRunFinishedAt('2026-07-05T10:00:00Z', 'COMPLETED');
            expect(result).toContain('2026');
        });

        it('returns "In progress" when null and status is running', () => {
            expect(formatRunFinishedAt(null, 'RUNNING')).toBe('In progress');
        });

        it('returns "Not reported" when null and status is terminal', () => {
            expect(formatRunFinishedAt(null, 'COMPLETED')).toBe('Not reported');
        });
    });

    describe('formatNumber', () => {
        it('formats an integer with locale separators', () => {
            expect(formatNumber(1234567)).toMatch(/1.234.567|1,234,567/);
        });
    });

    describe('createDataSource', () => {
        it('builds a data source with the right meta fields', () => {
            const source = createDataSource('GITHUB');
            expect(source.sourceSystem).toBe('GITHUB');
            expect(source.name).toBe(SOURCE_META.GITHUB.name);
            expect(source.type).toBe(SOURCE_META.GITHUB.type);
            expect(source.icon).toBe(SOURCE_META.GITHUB.icon);
            expect(source.statusLabel).toBe('Not synced');
            expect(source.artifacts).toBe(0);
            expect(source.lastSync).toBe('Never');
            expect(source.errors).toBe(0);
            expect(source.latestIngestedCount).toBe(0);
            expect(source.latestUpdatedCount).toBe(0);
            expect(source.failedItems).toEqual([]);
            expect(source.lastRunAt).toBeNull();
        });

        it('maps a synced status onto the data source', () => {
            const status: SourceIngestionStatus = {
                sourceSystem: 'GITHUB',
                lastRunTime: '2026-07-05T10:00:00Z',
                ingestedCount: 12,
                updatedCount: 3,
                failedCount: 0,
                status: 'COMPLETED',
                failedItems: [],
            };
            const source = createDataSource('GITHUB', status);
            expect(source.artifacts).toBe(12);
            expect(source.latestUpdatedCount).toBe(3);
            expect(source.errors).toBe(0);
            expect(source.status).toBe('connected');
            expect(source.statusLabel).toBe('Synced');
            expect(source.lastRunAt).toBe('2026-07-05T10:00:00Z');
            expect(source.lastSync).not.toBe('Never');
        });

        it('reflects errors in the warning status', () => {
            const status: SourceIngestionStatus = {
                sourceSystem: 'GITHUB',
                lastRunTime: '2026-07-05T10:00:00Z',
                ingestedCount: 5,
                updatedCount: 1,
                failedCount: 2,
                status: 'COMPLETED',
                failedItems: [{ artifactIdentifier: 'x', reason: 'boom' }],
            };
            const source = createDataSource('GITHUB', status);
            expect(source.status).toBe('warning');
            expect(source.errors).toBe(2);
            expect(source.failedItems).toHaveLength(1);
        });
    });

    describe('all run statuses are covered by getRunStatusLabel', () => {
        const statuses: IngestionRunStatus[] = ['CONNECTED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'];
        for (const status of statuses) {
            it(`labels ${status}`, () => {
                expect(getRunStatusLabel(status)).toBeTruthy();
            });
        }
    });
});
