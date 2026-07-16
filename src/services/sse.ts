/**
 * Shared SSE (Server-Sent Events) stream parser.
 *
 * Reads a `ReadableStream<Uint8Array>` (e.g. the `body` of a `fetch` response
 * with `Content-Type: text/event-stream`), buffers partial lines across chunk
 * boundaries, and yields each parsed `data:` JSON payload as a typed object.
 *
 * Used by `chatService`, `knowledgeService`, and `onboardingService` so the
 * brittle line-splitting / JSON-parsing logic lives in exactly one place.
 *
 * Robustness: malformed `data:` lines are skipped (logged via `console.warn`)
 * rather than aborting the whole stream — a single bad chunk from the backend
 * must not kill an otherwise healthy connection.
 */

/**
 * Async generator that yields each SSE `data:` event parsed from the stream.
 *
 * @param stream The raw response body (or any `ReadableStream<Uint8Array>`).
 * @returns Yields one parsed JSON payload per `data:` line. The generator
 *   completes when the stream ends naturally. If the underlying `reader.read()`
 *   throws (e.g. an `AbortError` when the caller aborts the `fetch`), the error
 *   propagates to the consumer — wrap the `for await` loop in a `try/catch`
 *   to distinguish aborts from connection drops.
 */
export async function* parseSSEStream<T>(
    stream: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data:")) continue;

                const payload = line.replace("data:", "").trim();
                if (!payload) continue;

                try {
                    yield JSON.parse(payload) as T;
                } catch {
                    console.warn("SSE: skipping malformed data line", payload);
                }
            }
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            // Lock may already be released — safe to ignore.
        }
    }
}
