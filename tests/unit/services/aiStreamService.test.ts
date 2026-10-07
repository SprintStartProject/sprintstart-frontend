import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { streamAiProgress } from "../../../src/services/aiStreamService";
import { mockKeycloakInstance, server } from "../../unit/setup/vitest.setup";

/** The smallest stream the service accepts: one `done` event, then a close. */
function doneStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
      controller.close();
    },
  });
}

describe("aiStreamService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeycloakInstance.authenticated = true;
    mockKeycloakInstance.token = "test-token";
    mockKeycloakInstance.updateToken.mockResolvedValue(true);
  });

  it("sends the bearer token while one is held", async () => {
    let capturedAuthHeader: string | null = null;
    server.use(
      http.post("/api/v1/example/stream", ({ request }) => {
        capturedAuthHeader = request.headers.get("Authorization");
        return new HttpResponse(doneStream(), {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    await streamAiProgress("/api/v1/example/stream", {
      onEvent: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(capturedAuthHeader).toBe("Bearer test-token");
  });

  it("sends no Authorization header when no token is held", async () => {
    mockKeycloakInstance.authenticated = false;
    Object.assign(mockKeycloakInstance, { token: undefined });
    let capturedAuthHeader: string | null = "unset";
    server.use(
      http.post("/api/v1/example/stream", ({ request }) => {
        capturedAuthHeader = request.headers.get("Authorization");
        return new HttpResponse(doneStream(), {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    await streamAiProgress("/api/v1/example/stream", {
      onEvent: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    // The literal "Bearer undefined" used to be sent here.
    expect(capturedAuthHeader).toBeNull();
  });
});
