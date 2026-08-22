import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

describe("useBuddy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("starts closed and does not load history until opened", () => {
    let requested = false;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => {
        requested = true;
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useBuddy());

    expect(result.current.isOpen).toBe(false);
    expect(requested).toBe(false);
  });

  it("loads conversation history when opened", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () =>
        HttpResponse.json([
          { role: "USER", content: "hi", createdAt: "2026-07-18T00:00:00.000Z" },
          { role: "ASSISTANT", content: "hello!", createdAt: "2026-07-18T00:00:01.000Z" },
        ]),
      ),
    );

    const { result } = renderHook(() => useBuddy());

    act(() => {
      result.current.toggleOpen();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[1].content).toBe("hello!");
    expect(result.current.messages[0].id).toBeTruthy();
  });

  it("optimistically adds messages and streams the reply", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"type":"token","content":"hi"}\n\n'));
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );

    const { result } = renderHook(() => useBuddy());

    act(() => {
      result.current.toggleOpen();
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(0));

    act(() => {
      result.current.setDraft("hello there");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe("hi");
    });
    expect(result.current.messages[0].role).toBe("USER");
    expect(result.current.messages[0].content).toBe("hello there");
    expect(result.current.messages[1].role).toBe("ASSISTANT");
    expect(result.current.isThinking).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.draft).toBe("");
  });

  it("toggles open state", () => {
    server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

    const { result } = renderHook(() => useBuddy());

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("echoes a proposal's confirm payload verbatim when the hire confirms", async () => {
    let confirmBody: Record<string, unknown> = {};
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"action_proposal","action":"request_attestation","label":"Ask them to confirm this","title":"the auth fix","attester_id":"u-9"}\n\n',
              ),
            );
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
      http.post("/api/v1/onboarding/me/buddy/actions", async ({ request }) => {
        confirmBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true, message: "Passed!" });
      }),
    );

    const { result } = renderHook(() => useBuddy());

    act(() => {
      result.current.toggleOpen();
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(0));

    act(() => {
      result.current.setDraft("here is my answer");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    // The proposal landed on the reply with its payload intact.
    await waitFor(() => {
      const action = result.current.messages[1]?.actions?.[0];
      expect(action?.action).toBe("request_attestation");
      expect(action?.title).toBe("the auth fix");
      expect(action?.attesterId).toBe("u-9");
    });

    act(() => {
      result.current.confirmAction(
        result.current.messages[1].id,
        result.current.messages[1].actions![0],
      );
    });

    await waitFor(() => {
      expect(confirmBody).toMatchObject({
        action: "request_attestation",
        title: "the auth fix",
        attesterId: "u-9",
      });
    });
    await waitFor(() => {
      expect(result.current.messages[1].actions?.[0].status).toBe("resolved");
    });
  });
});
