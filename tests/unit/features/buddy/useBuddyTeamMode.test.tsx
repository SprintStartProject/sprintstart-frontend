import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

/**
 * Team mode: one hook, two conversations.
 *
 * The dock hook (`useBuddy`) drives both surfaces, so these tests speak to the hire-facing API
 * — `switchTeamProject` and the returned `teamProjectId` — and assert on the wire what the
 * backend contract expects: the team target rides the query string on reads and opens, and the
 * message body on sends. The hire conversation must send none of it.
 */

/** A one-token greeting for whichever conversation opens — same stub logic as `useBuddy.test`.
 * The token matters: an all-silent open cannot be distinguished from one still to come, and a
 * test that switches on a not-yet-started greeting is switching mid-mount. */
function silentGreeting() {
  const encoder = new TextEncoder();
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"token","content":"Hel"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

/** A stored team proposal, streamed exactly as the backend spells it on the wire. */
function storedProposal(proposalId = "p-9", risk = "DESTRUCTIVE") {
  const encoder = new TextEncoder();
  const proposalLine = `data: {"type":"action_proposal","proposal_id":"${proposalId}","label":"Shift Task 0","preview":"Jonas takes Task 0 instead.","risk":"${risk}"}\n\n`;
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(proposalLine));
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("useBuddy — team mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    localStorage.removeItem("buddyTeamProjectId");
  });

  it("resets the thread and opens the team conversation under the team's query param", async () => {
    let hireMessageUrl = "";
    let teamMessageUrl = "";
    let teamOpenUrl = "";
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
        const search = new URL(request.url).search;
        if (search.includes("teamProjectId")) {
          teamMessageUrl = search;
        } else {
          hireMessageUrl = search;
        }
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/onboarding/me/buddy/open/stream", ({ request }) => {
        if (new URL(request.url).search.includes("teamProjectId")) {
          teamOpenUrl = new URL(request.url).search;
        }
        return silentGreeting();
      }),
      http.post("/api/v1/onboarding/me/buddy/messages", () => silentGreeting()),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    // The hire conversation opens on mount, without any team param — and the greeting it
    // writes has finished before a switch is legal (the switcher disables mid-turn, and the
    // hook refuses one). The greeting message landing is the finish signal.
    await waitFor(() => expect(hireMessageUrl).toBe(""));
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    expect(teamMessageUrl).toBe("");
    expect(result.current.teamProjectId).toBeNull();

    // Switching to team mode clears the thread and opens the team conversation.
    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    expect(result.current.teamProjectId).toBe("proj-1");
    expect(teamMessageUrl).toBe("?teamProjectId=proj-1");
    expect(teamOpenUrl).toBe("?teamProjectId=proj-1");
    // The hire thread did not survive the switch — the one message is the team conversation's
    // own greeting.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Hel");
  });

  it("persists team mode across a remount", async () => {
    let requestedUrl = "";
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
        requestedUrl = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );

    const first = renderHook(() => useBuddy(), { wrapper: BuddyProvider });
    await waitFor(() => expect(requestedUrl).toBe(""));

    // The greeting must have finished before a switch is legal — the greeting message landing
    // is the finish signal (isGreeting is false before the greeting even starts).
    await waitFor(() => expect(first.result.current.messages.length).toBeGreaterThan(0));
    await act(async () => {
      await first.result.current.switchTeamProject("proj-1");
    });
    await waitFor(() => expect(requestedUrl).toBe("?teamProjectId=proj-1"));

    // A fresh session — the reload case. The stored project id decides the conversation again.
    requestedUrl = "";
    const second = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    expect(second.result.current.teamProjectId).toBe("proj-1");
    await waitFor(() => expect(requestedUrl).toBe("?teamProjectId=proj-1"));
    await waitFor(() => expect(second.result.current.messages.length).toBeGreaterThan(0));

    // Leaving team mode removes the stored marker, so the next session starts in hire mode.
    await act(async () => {
      await second.result.current.switchTeamProject(null);
    });
    expect(localStorage.getItem("buddyTeamProjectId")).toBeNull();
  });

  it("confirms a stored proposal by id and shows the backend's own outcome line", async () => {
    let confirmBody: unknown = null;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async ({ request }) => {
        // The confirm POST is bodyless by contract — the id is in the URL.
        const raw = await request.text();
        confirmBody = raw === "" ? null : JSON.parse(raw);
        return HttpResponse.json({ ok: true, message: "Task 0 was reassigned to Jonas." });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    // The proposal rides a *reply*, so the manager has to ask for something first.
    act(() => {
      result.current.setDraft("shift Task 0");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.actions?.length)).toBe(true);
    });

    // The proposal arrived as a *stored* one: no tool name, an id, a preview and a risk.
    const message = result.current.messages.find((m) => m.actions?.length);
    const action = message?.actions?.[0];
    expect(action).toEqual(
      expect.objectContaining({
        proposalId: "p-9",
        label: "Shift Task 0",
        preview: "Jonas takes Task 0 instead.",
        risk: "DESTRUCTIVE",
        status: "idle",
      }),
    );
    expect(action && "action" in action).toBe(false);

    act(() => {
      result.current.confirmAction(message!.id, action!);
    });

    await waitFor(() => {
      expect(
        message && result.current.messages.find((m) => m.id === message.id)?.actions?.[0],
      ).toEqual(
        expect.objectContaining({
          status: "resolved",
          ok: true,
          outcome: "Task 0 was reassigned to Jonas.",
        }),
      );
    });

    // The whole confirm payload is the id — the client derived and sent nothing else.
    expect(confirmBody).toBeNull();
  });

  it("turns the 404 of an already-settled proposal into a legible outcome, not an error", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      http.post(
        "/api/v1/onboarding/me/buddy/proposals/p-9/confirm",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    act(() => {
      result.current.setDraft("shift Task 0");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.actions?.length)).toBe(true);
    });

    const message = result.current.messages.find((m) => m.actions?.length)!;
    const action = message.actions![0];

    act(() => {
      result.current.confirmAction(message.id, action);
    });

    await waitFor(() => {
      const settled = result.current.messages.find((m) => m.id === message.id)?.actions?.[0];
      expect(settled).toEqual(
        expect.objectContaining({
          status: "resolved",
          ok: false,
          outcome: "This proposal was already settled.",
        }),
      );
    });
  });

  it("dismisses a stored proposal at the backend, and keeps it offerable if that fails", async () => {
    let dismissRequested = false;
    let failDismiss = true;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      http.post("/api/v1/onboarding/me/buddy/proposals/p-9/dismiss", () => {
        if (failDismiss) return HttpResponse.error();
        dismissRequested = true;
        return HttpResponse.json({ ok: true, message: "Nothing changed." });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    act(() => {
      result.current.setDraft("shift Task 0");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.actions?.length)).toBe(true);
    });

    const message = result.current.messages.find((m) => m.actions?.length)!;
    const action = message.actions![0];

    act(() => {
      result.current.dismissAction(message.id, action.id);
    });

    // A failed dismissal does not half-happen: the offer stays on the table (idle, retryable).
    await waitFor(() => {
      expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0].status).toBe(
        "idle",
      );
    });

    failDismiss = false;
    act(() => {
      result.current.dismissAction(message.id, action.id);
    });

    await waitFor(() => {
      expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0].status).toBe(
        "dismissed",
      );
    });
    expect(dismissRequested).toBe(true);
  });

  it("refuses a second confirm of the same proposal within one frame", async () => {
    let confirmCount = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async () => {
        // Hold the first call open until both clicks have been processed.
        await new Promise((resolve) => setTimeout(resolve, 50));
        confirmCount += 1;
        return HttpResponse.json({ ok: true, message: "Done." });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    act(() => {
      result.current.setDraft("shift Task 0");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.actions?.length)).toBe(true);
    });

    const message = result.current.messages.find((m) => m.actions?.length)!;
    const action = message.actions![0];

    // Both clicks land inside the same React frame, before the "confirming" re-render: exactly
    // the double-fire a disable-on-render alone cannot catch.
    act(() => {
      result.current.confirmAction(message.id, action);
      result.current.confirmAction(message.id, action);
    });

    await waitFor(() => {
      expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0].status).toBe(
        "resolved",
      );
    });
    expect(confirmCount).toBe(1);
  });

  it("resolves a dismissal that met an already-settled proposal, instead of offering it forever", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      // Already settled elsewhere: the same 404 a confirm would meet.
      http.post(
        "/api/v1/onboarding/me/buddy/proposals/p-9/dismiss",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    act(() => {
      result.current.setDraft("shift Task 0");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.actions?.length)).toBe(true);
    });

    const message = result.current.messages.find((m) => m.actions?.length)!;
    const action = message.actions![0];

    act(() => {
      result.current.dismissAction(message.id, action.id);
    });

    // A 404 is the backend saying "this proposal is over" — the card must resolve to that
    // outcome, not return to idle and offer a change that cannot happen any more.
    await waitFor(() => {
      expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0]).toEqual(
        expect.objectContaining({
          status: "resolved",
          ok: false,
          outcome: "This proposal was already settled.",
        }),
      );
    });
  });

  it("refuses a switch while a greeting is still streaming, even past the first token", async () => {
    let teamMessageUrl = "";
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
        const search = new URL(request.url).search;
        if (search.includes("teamProjectId")) teamMessageUrl = search;
        return HttpResponse.json([]);
      }),
      // Streams one token, then never closes: the composer is already unlocked (`isOpening`
      // released at the first token) but the greeting is still in flight — exactly the window
      // this guard exists for.
      http.post(
        "/api/v1/onboarding/me/buddy/open/stream",
        () =>
          new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode('data: {"type":"token","content":"Hel"}\n\n'),
                );
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    // Wait for the greeting to be streaming (composer released, greeting not finished).
    await waitFor(() => expect(result.current.isOpening).toBe(false));
    expect(result.current.isGreeting).toBe(true);

    await act(async () => {
      await result.current.switchTeamProject("proj-1");
    });

    // Refused: still the hire conversation, and nothing was asked of the team endpoint.
    expect(result.current.teamProjectId).toBeNull();
    expect(teamMessageUrl).toBe("");
  });

  it("reads a blank stored team project as the hire's own conversation", async () => {
    let messagesUrl = "";
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
        messagesUrl = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );
    // However it got there, a blank marker is no conversation.
    localStorage.setItem("buddyTeamProjectId", "");

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    expect(result.current.teamProjectId).toBeNull();
    await waitFor(() => expect(messagesUrl).toBe(""));
  });
});
