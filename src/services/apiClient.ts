import keycloak from '../config/keycloak';

/**
 * Standard API response error class.
 */
export class ApiError extends Error {
    public status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

/**
 * Derives a human-readable message from an error response body.
 *
 * Two JSON shapes are understood so the user never sees raw JSON:
 *  - the backend's custom exception handler returns `{ "message": string }`
 *    (403/404 etc.) — its `message` is used directly;
 *  - Spring's default error body `{ timestamp, status, error, message, path }`
 *    often carries an empty `message` (e.g. a 500), so its `error` phrase
 *    ("Internal Server Error", "Not Found", …) is surfaced instead of dumping
 *    the whole object, timestamp and all, at the user.
 *
 * Non-JSON bodies (and JSON without either usable field) fall back to the raw
 * text, then to the HTTP status text.
 */
function extractErrorMessage(body: string, statusText: string): string {
    const trimmed = body.trim();

    if (trimmed) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (parsed !== null && typeof parsed === 'object') {
                const { message, error } = parsed as {
                    message?: unknown;
                    error?: unknown;
                };

                if (typeof message === 'string' && message.trim()) {
                    return message;
                }
                if (typeof error === 'string' && error.trim()) {
                    return error;
                }
            }
        } catch {
            // Not JSON — fall through to the raw text.
        }
    }

    return trimmed || statusText;
}

/**
 * A central API client wrapper around the native fetch API.
 * Automatically injects the Keycloak JWT token into the Authorization header.
 */
export const apiClient = {
    /**
     * Performs an authenticated fetch request.
     *
     * @param endpoint - The API endpoint (e.g., '/api/v1/users/me').
     * @param options - Standard fetch options.
     * @returns The parsed JSON response.
     * @throws ApiError if the response is not OK.
     */
    async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        // Ensure the token is up to date (refresh if it expires in < 30s)
        try {
            if (keycloak.authenticated) {
                await keycloak.updateToken(30);
            }
        } catch (error) {
            console.error('Failed to refresh Keycloak token', error);
            void keycloak.login(); // Redirect to login if token refresh fails completely
        }

        const headers = new Headers(options.headers);

        if (keycloak.token) {
            headers.set('Authorization', `Bearer ${keycloak.token}`);
        }

        // Default content type to JSON if not specified and not FormData
        if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(endpoint, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            // Token likely expired or invalid, force re-auth
            void keycloak.login();
            throw new ApiError(401, 'Unauthorized');
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new ApiError(response.status, extractErrorMessage(errorBody, response.statusText));
        }

        const text = await response.text();
        if (!text.trim()) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    }
};
