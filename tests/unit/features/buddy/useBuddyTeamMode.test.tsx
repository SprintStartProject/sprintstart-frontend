import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProjectSelectionSlice } from "../../../../src/features/buddy/hooks/useBuddyConversation";
import { useBuddyConversation } from "../../../../src/features/buddy/hooks/useBuddyConversation";
import { AuthContext, type AuthContextType } from "../../../../src/context/AuthContext";
import type { UserProfile } from "../../../../src/services/types";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

/**
 * Team mode, at the hook level. The session is tested directly rather than through
 * `BuddyProvider` so the *selection slice* is a parameter the test can move — team mode is
 * bound to the globally selected project, and "the selection moved" is exactly the event these
 * tests have to be able to fire. The wire contract is asserted as the backend spells it: the
 * team target rides the query string on reads and opens, and the message body on sends.
 */

const TEST_USER_ID = "user-1";

function authValue(profileId: string | null = TEST_USER_ID): AuthContextType {
  const profile = profileId === null ? null : ({ id: profileId } as unknown as UserProfile);
  return {
    status: profile ? "authenticated" : "unauthenticated",
    profile,
    login: async () => {},
    logout: async () => {},
    refetchProfile: async () => {},
  };
}

function sel(
  selectedProjectId: string,
  canManageSelected: boolean,
  overrides: Partial<ProjectSelectionSlice> = {},
): ProjectSelectionSlice {
  return {
    selectedProjectId,
    hasSelectedProject: selectedProjectId !== "",
    canManageSelected,
    isLoading: false,
    setSelectedProjectId: vi.fn(),
    ...overrides,
  };
}

const authWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={authValue()}>{children}</AuthContext.Provider>
);

/** A one-token greeting, so "the greeting finished" is observable in the message list. */
function oneTokenGreeting() {
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

/** A reply carrying a stored team proposal, offer intact. */
function storedProposal() {
  const encoder = new TextEncoder();
  const proposalLine =
    'data: {"type":"action_proposal","proposal_id":"p-9","label":"Shift Task 0",' +
    '"preview":"Jonas takes Task 0 instead.","risk":"DESTRUCTIVE"}\n\n';
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

describe("useBuddyConversation — team mode", () => {
  let messagesUrl: string;
  let openUrl: string;
  let confirmCount: number;
  let dismissCount: number;

  beforeEach(() => {
    localStorage.clear();
    messagesUrl = "";
    openUrl = "";
    confirmCount = 0;
    dismissCount = 0;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
        messagesUrl = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
      http.post("/api/v1/onboarding/me/buddy/open/stream", ({ request }) => {
        openUrl = new URL(request.url).search;
        return oneTokenGreeting();
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches to a managed project: the selection is driven, the thread resets, the team conversation opens", async () => {
    const setSelectedProjectId = vi.fn();
    const onLeft = vi.fn();
    const { result, rerender } = renderHook(
      ({ selection, onLeft }: { selection: ProjectSelectionSlice; onLeft?: () => void }) =>
        useBuddyConversation(selection, onLeft),
      {
        initialProps: { selection: sel("", false, { setSelectedProjectId }), onLeft },
        wrapper: authWrapper,
      },
    );
    await act(async () => {
      await result.current.ensureOpened();
    });

    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    const hireGreetingId = result.current.messages[0].id;

    // The buddy's own switch drives the global selection and the preference in one commit —
    // exactly what the real provider batches, which is why the adopt/exit effect never reads
    // the buddy's switch as an exit.
    act(() => {
      result.current.switchTeamProject("p1");
      rerender({ selection: sel("p1", true, { setSelectedProjectId }), onLeft });
    });

    expect(setSelectedProjectId).toHaveBeenCalledWith("p1");
    expect(result.current.isTeamMode).toBe(true);
    expect(result.current.teamProjectId).toBe("p1");
    await waitFor(() => expect(messagesUrl).toBe("?teamProjectId=p1"));
    await waitFor(() => expect(openUrl).toBe("?teamProjectId=p1"));
    // The hire thread did not survive: the one message is the team conversation's own greeting.
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    expect(result.current.messages[0].id).not.toBe(hireGreetingId);
    expect(localStorage.getItem("buddyTeamMode:user-1")).toBe("true");
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("persists the preference per user, restores it on remount, and leaves it audibly", async () => {
    localStorage.setItem("buddyTeamMode:user-1", "true");
    localStorage.setItem("buddyTeamMode:user-2", "true");

    const onLeft = vi.fn();
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, onLeft),
      { initialProps: { selection: sel("p1", true) }, wrapper: authWrapper },
    );

    // user-1's own preference restores and adopts the vouched selection; user-2's is ignored.
    await waitFor(() => expect(result.current.isTeamMode).toBe(true));
    await waitFor(() => expect(result.current.teamProjectId).toBe("p1"));
    await waitFor(() => expect(messagesUrl).toBe("?teamProjectId=p1"));
    expect(onLeft).not.toHaveBeenCalled();

    act(() => {
      result.current.switchTeamProject(null);
    });
    expect(result.current.isTeamMode).toBe(false);
    expect(result.current.teamProjectId).toBeNull();
    expect(localStorage.getItem("buddyTeamMode:user-1")).toBe("false");
    expect(localStorage.getItem("buddyTeamMode:user-2")).toBe("true");
    expect(onLeft).not.toHaveBeenCalled();
    await waitFor(() => expect(messagesUrl).toBe(""));
  });

  it("does not inherit another user's team preference", () => {
    localStorage.setItem("buddyTeamMode:user-2", "true");
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, vi.fn()),
      { initialProps: { selection: sel("p1", true) }, wrapper: authWrapper },
    );

    expect(result.current.isTeamMode).toBe(false);
    expect(result.current.teamProjectId).toBeNull();
  });

  it("exits audibly when the selection moves to another project while the buddy is mid-conversation", async () => {
    // Team mode is live from restore: the preference was left on in a previous session, and
    // the loaded list vouches for this selection.
    localStorage.setItem("buddyTeamMode:user-1", "true");
    const onLeft = vi.fn();
    const { result, rerender } = renderHook(
      ({ selection, onLeft }: { selection: ProjectSelectionSlice; onLeft?: () => void }) =>
        useBuddyConversation(selection, onLeft),
      { initialProps: { selection: sel("p1", true), onLeft }, wrapper: authWrapper },
    );
    await act(async () => {
      await result.current.ensureOpened();
    });
    await waitFor(() => expect(messagesUrl).toBe("?teamProjectId=p1"));

    rerender({ selection: sel("p2", true), onLeft });

    await waitFor(() => expect(result.current.isTeamMode).toBe(false));
    expect(result.current.teamProjectId).toBeNull();
    expect(onLeft).toHaveBeenCalledTimes(1);
    // The hire conversation takes over, under no team param.
    await waitFor(() => expect(messagesUrl).toBe(""));
  });

  it("exits audibly when management of the selected project is lost", async () => {
    // Team mode is live from restore: the preference was left on in a previous session, and
    // the loaded list vouches for this selection.
    localStorage.setItem("buddyTeamMode:user-1", "true");
    const onLeft = vi.fn();
    const { result, rerender } = renderHook(
      ({ selection, onLeft }: { selection: ProjectSelectionSlice; onLeft?: () => void }) =>
        useBuddyConversation(selection, onLeft),
      { initialProps: { selection: sel("p1", true), onLeft }, wrapper: authWrapper },
    );
    await act(async () => {
      await result.current.ensureOpened();
    });
    await waitFor(() => expect(messagesUrl).toBe("?teamProjectId=p1"));

    rerender({ selection: sel("p1", false), onLeft });

    await waitFor(() => expect(result.current.isTeamMode).toBe(false));
    expect(result.current.teamProjectId).toBeNull();
    expect(onLeft).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(messagesUrl).toBe(""));
  });

  it("exits audibly on restore when there is no selection to bind to", async () => {
    localStorage.setItem("buddyTeamMode:user-1", "true");
    const onLeft = vi.fn();
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, onLeft),
      { initialProps: { selection: sel("", false) }, wrapper: authWrapper },
    );

    // Waits on the actual event, not on `isTeamMode`, which already reads `false` at the very
    // first render — the restore only overwrites it after a microtask, so a check on that value
    // alone can resolve before the audit ever ran.
    await waitFor(() => expect(onLeft).toHaveBeenCalledTimes(1));
    expect(result.current.isTeamMode).toBe(false);
    expect(result.current.teamProjectId).toBeNull();
    expect(localStorage.getItem("buddyTeamMode:user-1")).toBe("false");
  });

  it("reads a blank stored preference as hire mode", () => {
    localStorage.setItem("buddyTeamMode:user-1", "");
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, vi.fn()),
      { initialProps: { selection: sel("p1", true) }, wrapper: authWrapper },
    );

    expect(result.current.isTeamMode).toBe(false);
    expect(messagesUrl).toBe("");
  });

  it("refuses a switch while a greeting is still streaming, even past the first token", async () => {
    server.use(
      http.post(
        "/api/v1/onboarding/me/buddy/open/stream",
        () =>
          new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode('data: {"type":"token","content":"Hel"}\n\n'),
                );
                // Never closes — the greeting stays in flight for the whole test.
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const setSelectedProjectId = vi.fn();
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, vi.fn()),
      {
        initialProps: { selection: sel("", false, { setSelectedProjectId }) },
        wrapper: authWrapper,
      },
    );
    act(() => {
      // Not awaited: this stream never resolves, and awaiting it would hang the test. The
      // in-flight stream is exactly what the test needs — see the refused switch below.
      void result.current.ensureOpened();
    });

    // The composer unlocked at the first token; the greeting is still being written.
    await waitFor(() => expect(result.current.isOpening).toBe(false));
    expect(result.current.isGreeting).toBe(true);

    act(() => {
      result.current.switchTeamProject("p1");
    });

    // Refused: still the hire conversation, and nothing was asked of the selection.
    expect(setSelectedProjectId).not.toHaveBeenCalled();
    expect(result.current.isTeamMode).toBe(false);
    expect(messagesUrl).toBe("");
  });

  it("refuses a switch while a proposal decision is in flight", async () => {
    server.use(
      http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()),
      // The held-open response keeps the decision in flight long enough for a switch to try
      // to slip through it in the same frame.
      http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async () => {
        confirmCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json({ ok: true, message: "Task 0 was reassigned to Jonas." });
      }),
    );

    const setSelectedProjectId = vi.fn();
    // Team mode is live from restore (the preference was left on in a previous session), so
    // the decision below is one a team conversation is making.
    localStorage.setItem("buddyTeamMode:user-1", "true");
    const { result } = renderHook(
      ({ selection }: { selection: ProjectSelectionSlice }) =>
        useBuddyConversation(selection, vi.fn()),
      {
        initialProps: { selection: sel("p1", true, { setSelectedProjectId }) },
        wrapper: authWrapper,
      },
    );
    await act(async () => {
      await result.current.ensureOpened();
    });
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));

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
    // Both land in one frame: the decision starts, and the switch tries to clear the thread
    // out from under it before the "deciding" state has even re-rendered.
    act(() => {
      result.current.confirmAction(message.id, action);
      result.current.switchTeamProject("p2");
    });

    expect(setSelectedProjectId).not.toHaveBeenCalledWith("p2");
    expect(result.current.isTeamMode).toBe(true);
    expect(result.current.teamProjectId).toBe("p1");

    await waitFor(() =>
      expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0].status).toBe(
        "resolved",
      ),
    );
  });

  describe("stored proposal decisions", () => {
    beforeEach(() => {
      server.use(http.post("/api/v1/onboarding/me/buddy/messages", () => storedProposal()));
    });

    /** Team mode on, one proposal on the last reply. */
    async function openTeamWithProposal() {
      const { result } = renderHook(
        ({ selection }: { selection: ProjectSelectionSlice }) =>
          useBuddyConversation(selection, vi.fn()),
        { initialProps: { selection: sel("p1", true) }, wrapper: authWrapper },
      );
      await act(async () => {
        await result.current.ensureOpened();
      });
      await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
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
      return { result, message, action: message.actions![0] };
    }

    it("confirms a stored proposal by id and shows the backend's own outcome line", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async ({ request }) => {
          // The confirm POST is bodyless by contract — the id is in the URL.
          const raw = await request.text();
          expect(raw).toBe("");
          confirmCount += 1;
          return HttpResponse.json({ ok: true, message: "Task 0 was reassigned to Jonas." });
        }),
      );

      const { result, message, action } = await openTeamWithProposal();

      act(() => {
        result.current.confirmAction(message.id, action);
      });

      await waitFor(() => {
        const stored = result.current.messages.find((m) => m.id === message.id)?.actions?.[0];
        expect(stored?.status).toBe("resolved");
        expect(stored && "outcome" in stored ? stored.outcome : undefined).toBe(
          "Task 0 was reassigned to Jonas.",
        );
      });
      expect(confirmCount).toBe(1);
    });

    it("reads a settled proposal's 200 ok:false as the legible outcome, not an error", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", () =>
          HttpResponse.json({ ok: false, message: "This was already confirmed." }),
        ),
      );

      const { result, message, action } = await openTeamWithProposal();

      act(() => {
        result.current.confirmAction(message.id, action);
      });

      await waitFor(() => {
        const stored = result.current.messages.find((m) => m.id === message.id)?.actions?.[0];
        expect(stored?.status).toBe("resolved");
        expect(stored && "outcome" in stored ? stored.outcome : undefined).toBe(
          "This was already confirmed.",
        );
      });
    });

    it("resolves a confirm that met a 404 as no longer available", async () => {
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/proposals/p-9/confirm",
          () => new HttpResponse(null, { status: 404 }),
        ),
      );

      const { result, message, action } = await openTeamWithProposal();

      act(() => {
        result.current.confirmAction(message.id, action);
      });

      await waitFor(() => {
        const stored = result.current.messages.find((m) => m.id === message.id)?.actions?.[0];
        expect(stored?.status).toBe("resolved");
        expect(stored && "outcome" in stored ? stored.outcome : undefined).toBe(
          "This proposal is no longer available.",
        );
      });
    });

    it("surfaces the backend's own refusal when a dismissal meets an already-settled proposal", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/dismiss", () =>
          HttpResponse.json({ ok: false, message: "This was already confirmed." }),
        ),
      );

      const { result, message, action } = await openTeamWithProposal();

      act(() => {
        result.current.dismissAction(message.id, action.id);
      });

      // "Dismissed — nothing changed" would be a lie over a change that already happened; the
      // backend's sentence is the truth the card shows.
      await waitFor(() => {
        const stored = result.current.messages.find((m) => m.id === message.id)?.actions?.[0];
        expect(stored?.status).toBe("resolved");
        expect(stored && "outcome" in stored ? stored.outcome : undefined).toBe(
          "This was already confirmed.",
        );
      });
      expect(dismissCount).toBe(0);
    });

    it("dismisses at the backend, and keeps the offer retryable when that transport-fails", async () => {
      let failDismiss = true;
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/dismiss", () => {
          if (failDismiss) return HttpResponse.error();
          dismissCount += 1;
          return HttpResponse.json({ ok: true, message: "Dismissed — nothing changed." });
        }),
      );

      const { result, message, action } = await openTeamWithProposal();

      act(() => {
        result.current.dismissAction(message.id, action.id);
      });
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
      expect(dismissCount).toBe(1);
    });

    it("keeps confirm and dismiss mutually exclusive within one frame", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async () => {
          confirmCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({ ok: true, message: "Done." });
        }),
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/dismiss", () => {
          dismissCount += 1;
          return HttpResponse.json({ ok: true, message: "Dismissed — nothing changed." });
        }),
      );

      const { result, message, action } = await openTeamWithProposal();

      // Both clicks land inside the same React frame, before any "confirming" re-render —
      // exactly the race a disable-on-render alone cannot catch.
      act(() => {
        result.current.confirmAction(message.id, action);
        result.current.dismissAction(message.id, action.id);
      });

      await waitFor(() => {
        expect(result.current.messages.find((m) => m.id === message.id)?.actions?.[0].status).toBe(
          "resolved",
        );
      });
      expect(confirmCount).toBe(1);
      expect(dismissCount).toBe(0);
    });

    it("refuses a second confirm of the same proposal within one frame", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/p-9/confirm", async () => {
          confirmCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return HttpResponse.json({ ok: true, message: "Done." });
        }),
      );

      const { result, message, action } = await openTeamWithProposal();

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
  });
});
