import { describe, it, expect } from 'vitest';
import { ApiError } from '../../../src/services/apiClient';
import { parseApiError, describeRefreshFailure } from '../../../src/services/apiError';

describe('parseApiError', () => {
    it('returns "An unexpected error occurred" for a plain string', () => {
        expect(parseApiError('raw string', 'fallback')).toBe('An unexpected error occurred.');
    });

    it('returns Error.message for a standard Error', () => {
        expect(parseApiError(new Error('something broke'), 'fallback')).toBe('something broke');
    });

    it('extracts the message field from a JSON ApiError body', () => {
        const error = new ApiError(400, '{"message":"email is required"}');
        expect(parseApiError(error, 'fallback')).toBe('email is required');
    });

    it('returns fallback when ApiError body is not valid JSON', () => {
        const error = new ApiError(500, 'Internal Server Error');
        expect(parseApiError(error, 'fallback')).toBe('fallback');
    });

    it('returns fallback when ApiError JSON body has no message field', () => {
        const error = new ApiError(400, '{"code":"E001"}');
        expect(parseApiError(error, 'fallback')).toBe('fallback');
    });
});

describe('describeRefreshFailure', () => {
    it('describes a generic error', () => {
        const result = describeRefreshFailure(new Error('network error'));
        expect(result).toContain("couldn't be refreshed");
        expect(result).toContain('network error');
    });

    it('describes an unknown error type', () => {
        const result = describeRefreshFailure('something');
        expect(result).toContain('Unknown error');
    });
});