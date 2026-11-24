import keycloak from "../../config/keycloak";
import type { BuddyStreamChunk } from "./streamChunk";

/**
 * How a buddy stream finished.
 *
 * Three outcomes, not two, and the difference decides whether the caller announces completion.
 * `terminated` means the server said `done` or `error` and has already been reported. `ended` means
 * the body ran out with no terminal event, so the caller still owes its own `onDone`. `aborted`
 * means the request never produced a stream at all — the caller must not announce completion
 * there, because nothing was answered.
 */
export type BuddyStreamOutcome = "terminated" | "ended" | "aborted";

type ChunkHandler = (chunk: BuddyStreamChunk) => "stop" | void;

/**
 * A stop the hire asked for, told apart from a failure.
 *
 * Both `fetch` and the reader reject with this on abort — `name` rather than `instanceof`,
 * because a DOMException is not an `Error` subclass in every engine that runs this.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** Refreshes the token when it expires in under 30s; false when that failed and login was started. */
async function ensureFreshToken(): Promise<boolean> {
  try {
    if (keycloak.authenticated) {
      await keycloak.updateToken(30);
    }
    return true;
  } catch (error) {
    console.error("Failed to refresh Keycloak token for buddy stream", error);
    void keycloak.login();
    return false;
  }
}

type Request = {
  path: string;
  body: unknown;
  signal?: AbortSignal;
  onError?: (message: string) => void;
};

/** The streaming response, or null after the failure has been reported (or, on abort, kept silent). */
async function openStream({ path, body, signal, onError }: Request): Promise<Response | null> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An abort is the hire's Stop, not a failure: it is reported to nobody, and the caller
    // reads it from the signal it passed in. Everything else is reported rather than thrown,
    // so "we never reached the server" arrives at the caller's error surface as a sentence
    // instead of as a rejection it has to translate. The only thing the hire needs from this
    // is whether trying again is worth it.
    if (!isAbortError(error)) onError?.("Could not reach the server.");
    return null;
  }

  if (!res.ok) {
    onError?.(`HTTP error! status: ${res.status}`);
    return null;
  }

  return res;
}

/** One `data:` line as a chunk; anything else — keep-alives, a proxy's own text — is null. */
function parseDataLine(line: string): BuddyStreamChunk | null {
  if (!line.startsWith("data:")) return null;

  try {
    return JSON.parse(line.replace("data:", "").trim()) as BuddyStreamChunk;
  } catch {
    // A malformed chunk is skipped, never fatal -- the same tolerance the backend applies,
    // and what `aiStreamService` already does with the identical framing. One unparseable
    // line (a keep-alive, a proxy's own text, a truncated tail) must not throw out of the
    // loop and take the rest of the reply with it.
    return null;
  }
}

/** Hands each parsed line to the handler; true as soon as the handler says to stop. */
function dispatchLines(lines: string[], onChunk: ChunkHandler): boolean {
  for (const line of lines) {
    const event = parseDataLine(line);
    if (event && onChunk(event) === "stop") return true;
  }
  return false;
}

async function pumpStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: ChunkHandler,
  onError?: (message: string) => void,
): Promise<BuddyStreamOutcome> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      if (dispatchLines(lines, onChunk)) {
        // The caller is finished with this stream, so let go of the body rather than leaving
        // an open connection for the collector to notice eventually.
        void reader.cancel();
        return "terminated";
      }
    }
  } catch (error) {
    // An abort mid-read is the hire's Stop — the same silent path as above.
    if (isAbortError(error)) return "aborted";
    // A connection dropped mid-stream. Without this it rejected out of the function, past every
    // `onError` the caller wired up, and whatever had streamed so far simply stopped.
    console.error("Buddy stream failed mid-response", error);
    onError?.("The connection to your buddy dropped.");
    return "aborted";
  }

  return "ended";
}

/**
 * Reads one of the buddy's Server-Sent Event endpoints, handing each parsed chunk to `onChunk`.
 *
 * Extracted once there were two callers — sending a message and opening a visit — rather than in
 * advance: token refresh, the HTTP check, the `data:` framing and the buffered line split are
 * identical for both, and only the handling of each chunk differs.
 *
 * `onChunk` returns `"stop"` to end the read, which is how a terminal `done` or `error` closes the
 * stream without every caller writing its own loop exit.
 */
export async function readBuddyStream(
  path: string,
  body: unknown,
  onChunk: ChunkHandler,
  onError?: (message: string) => void,
  signal?: AbortSignal,
): Promise<BuddyStreamOutcome> {
  if (!(await ensureFreshToken())) return "aborted";

  const res = await openStream({ path, body, signal, onError });
  if (!res) return "aborted";

  const reader = res.body?.getReader();

  if (!reader) {
    // Reported like every other failure here rather than thrown: a caller that wired up
    // `onError` should not also have to wrap the call.
    onError?.("No response stream.");
    return "aborted";
  }

  return await pumpStream(reader, onChunk, onError);
}
