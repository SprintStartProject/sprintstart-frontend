import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { openAiBuddy } from "../../../../src/features/buddy/aiBuddyBus";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { queryKeys } from "../../../../src/services/queryKeys";

/**
 * A greeting that opens the visit and writes nothing.
 *
 * The hook opens a visit on mount, so every test below makes that request whether it is about
 * the greeting or not. Stubbed to silence rather than left unhandled: an unhandled request is a
 * *failed* greeting, and a failed greeting on an empty thread is reported to the hire -- which
 * is correct behaviour (see `buddyFailures`) and would put a turn in front of everything these
 * tests index into. A greeting that produces no words leaves no trace, which is what they want.
 */
function silentGreeting() {
  const encoder = new TextEncoder();
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done"}\\n\\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

describe("useBuddy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  /**
   * The dock starts closed, but the conversation does not wait for it to open. Writing a
   * greeting is the slow part of meeting the buddy — a remote model — and the widget mounts the
   * moment a hire's session resolves, long before they click. Doing the work here is what makes
   * the click find the conversation already there.
   *
   * It reads rather than opening blind; `buddyVisitContinuity` covers why that distinction is
   * the whole ballgame.
   */
  it("starts closed, with the conversation already on its way", async () => {
    let requested = false;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => {
        requested = true;
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    expect(result.current.isOpen).toBe(false);
    await waitFor(() => {
      expect(requested).toBe(true);
    });
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

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

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
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
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

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

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

  /**
   * The backend can emit `action_proposal` before it has written a word, which put an
   * "Accept this task" button on screen above an empty bubble — the hire was asked to agree to
   * something the buddy had not said yet. Proposals are held until the reply finishes, so the
   * order is always: what it wants to do, then the button that does it.
   */
  it("holds a proposal back until the reply it belongs to has been written", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Proposal first, then the words — and the stream stays open, so nothing has
            // finished yet.
            controller.enqueue(
              encoder.encode(
                'data: {"type":"action_proposal","action":"claim_goal","label":"Accept this task","task_id":"t1"}\n\n',
              ),
            );
            controller.enqueue(
              encoder.encode('data: {"type":"token","content":"Here is a good first task."}\n\n'),
            );
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    act(() => {
      result.current.setDraft("what should I work on?");
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.content).toBe("Here is a good first task.");
    });
    expect(result.current.messages.at(-1)?.actions ?? []).toHaveLength(0);
  });

  /**
   * The case every surface that seeds a draft depends on: the hire was not in the dock when they
   * pressed the button. A seed that only landed in an already-open dock would make "Ask the
   * buddy" on a selection do nothing visible from most of the app.
   */
  it("opens a closed dock and seeds the composer", async () => {
    server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      openAiBuddy({ draft: "> The migration runs on deploy.\n\n" });
    });

    await waitFor(() => expect(result.current.isOpen).toBe(true));
    expect(result.current.draft).toBe("> The migration runs on deploy.\n\n");
  });

  /** Seeded, never sent: the question the hire is about to type is the point of the message. */
  it("does not send what it was handed", async () => {
    let sent = false;
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.post("/api/v1/onboarding/me/buddy/messages", () => {
        sent = true;
        return silentGreeting();
      }),
    );

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

    act(() => {
      openAiBuddy({ draft: "> The migration runs on deploy.\n\n" });
    });

    await waitFor(() => expect(result.current.isOpen).toBe(true));
    expect(sent).toBe(false);
    expect(result.current.messages).toHaveLength(0);
  });

  /**
   * The draft outlives the dock: close it mid-sentence and the words are still there. A seed that
   * arrives afterwards — a selection, a card's question — must not be the thing that erases them.
   */
  describe("a seed on top of words the hire already typed", () => {
    const QUOTE = "> The migration runs on deploy.\n\n";

    it("keeps a closed dock's saved draft and puts the seed under it", async () => {
      server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

      const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
      act(() => {
        result.current.setDraft("why does the deploy");
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        openAiBuddy({ draft: QUOTE });
      });

      await waitFor(() => expect(result.current.isOpen).toBe(true));
      expect(result.current.draft).toBe(`why does the deploy\n\n${QUOTE}`);
    });

    it("keeps an open dock's draft the same way", async () => {
      server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

      const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
      act(() => {
        result.current.toggleOpen();
        result.current.setDraft("why does the deploy");
      });

      act(() => {
        openAiBuddy({ draft: QUOTE });
      });

      await waitFor(() => expect(result.current.draft).toBe(`why does the deploy\n\n${QUOTE}`));
      expect(result.current.isOpen).toBe(true);
    });

    /** Pressing the same button twice is not asking twice. */
    it("does not stack the same seed twice", async () => {
      server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

      const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

      act(() => {
        openAiBuddy({ draft: QUOTE });
      });
      act(() => {
        openAiBuddy({ draft: QUOTE });
      });

      await waitFor(() => expect(result.current.isOpen).toBe(true));
      expect(result.current.draft).toBe(QUOTE);
    });
  });

  it("toggles open state", () => {
    server.use(http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])));

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

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
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
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

    const { result } = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });

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
      // A hire proposal is one kind of `ProposedAction` now; the stored kind never carries a
      // tool name, so this test's expectations only hold on the hire one.
      expect(action && "action" in action ? action.action : undefined).toBe("request_attestation");
      expect(action && "title" in action ? action.title : undefined).toBe("the auth fix");
      expect(action && "attesterId" in action ? action.attesterId : undefined).toBe("u-9");
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
  /**
   * The seam between the card and the hook. The card offers "Try again" on a hire action that
   * came back "couldn't"; the hook has to let that second confirm through. Rendered-component
   * tests mock `onConfirm`, so only a test at this level sees the two meet.
   */
  describe("confirming a resolved hire offer again", () => {
    function offerChecklist() {
      const encoder = new TextEncoder();
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"action_proposal","action":"place_checklist","label":"Keep this as a checklist","checklist_title":"Getting started","checklist_items":["Run it locally","Open a PR"]}\n\n',
              ),
            );
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }

    async function confirmOnce(ok: boolean) {
      let calls = 0;
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
        http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
        http.post("/api/v1/onboarding/me/buddy/messages", () => offerChecklist()),
        http.post("/api/v1/onboarding/me/buddy/actions", () => {
          calls += 1;
          return HttpResponse.json({
            ok,
            message: ok ? "Kept." : "I couldn't keep that just now.",
          });
        }),
      );

      const hook = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
      act(() => {
        hook.result.current.toggleOpen();
      });
      await waitFor(() => expect(hook.result.current.messages).toHaveLength(0));
      act(() => {
        hook.result.current.setDraft("how do I start?");
      });
      act(() => {
        hook.result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });
      await waitFor(() => expect(hook.result.current.messages[1]?.actions?.[0]).toBeDefined());

      act(() => {
        hook.result.current.confirmAction(
          hook.result.current.messages[1].id,
          hook.result.current.messages[1].actions![0],
        );
      });
      await waitFor(() => {
        const action = hook.result.current.messages[1].actions?.[0];
        expect(action?.status).toBe("resolved");
        expect(action?.ok).toBe(ok);
      });

      return { result: hook.result, calls: () => calls };
    }

    it("sends a refused hire offer again when the hire retries it", async () => {
      const { result, calls } = await confirmOnce(false);
      expect(calls()).toBe(1);

      // What the "Try again" button does: confirm the resolved action as it stands.
      act(() => {
        result.current.confirmAction(
          result.current.messages[1].id,
          result.current.messages[1].actions![0],
        );
      });

      await waitFor(() => expect(calls()).toBe(2));
    });

    /** Confirming a success twice is how somebody claims the same task twice. */
    it("never sends a hire offer again once it worked", async () => {
      const { result, calls } = await confirmOnce(true);

      act(() => {
        result.current.confirmAction(
          result.current.messages[1].id,
          result.current.messages[1].actions![0],
        );
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(calls()).toBe(1);
      expect(result.current.messages[1].actions?.[0].status).toBe("resolved");
    });
  });

  /**
   * The board a confirmed action writes to is a cache entry nobody here is looking at: the dock
   * can float over the board page, and a visit within `staleTime` serves the board as it was read.
   * These pin which confirms mark it stale — and which correctly do not.
   */
  describe("board synchronisation", () => {
    /** A client already holding this hire's board, and a wrapper that puts it under the session. */
    function boardContext() {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(queryKeys.board.byProject("p1"), {
        boardId: "b1",
        projectId: "p1",
        cards: [],
      });

      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={client}>
            <BuddyProviderWithStubs>{children}</BuddyProviderWithStubs>
          </QueryClientProvider>
        );
      }

      return { client, Wrapper };
    }

    const boardIsStale = (client: QueryClient) =>
      client.getQueryState(queryKeys.board.byProject("p1"))?.isInvalidated ?? false;

    function stream(events: string[]) {
      const encoder = new TextEncoder();
      return new HttpResponse(
        new ReadableStream({
          start(controller) {
            for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }

    /** Opens the session, sends a question whose reply proposes `proposalEvent`, and confirms it. */
    async function confirmProposal(
      proposalEvent: string,
      outcome: { ok: boolean; message: string },
    ) {
      const { client, Wrapper } = boardContext();
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
        http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
        http.post("/api/v1/onboarding/me/buddy/messages", () => stream([proposalEvent])),
        http.post("/api/v1/onboarding/me/buddy/actions", () => HttpResponse.json(outcome)),
      );

      const { result } = renderHook(() => useBuddy(), { wrapper: Wrapper });
      act(() => {
        result.current.toggleOpen();
      });
      await waitFor(() => expect(result.current.messages).toHaveLength(0));
      act(() => {
        result.current.setDraft("how do I start?");
      });
      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });
      await waitFor(() => expect(result.current.messages[1]?.actions?.[0]).toBeDefined());

      act(() => {
        result.current.confirmAction(
          result.current.messages[1].id,
          result.current.messages[1].actions![0],
        );
      });
      await waitFor(() => expect(result.current.messages[1].actions?.[0].status).toBe("resolved"));

      return { client };
    }

    const PLACE_CHECKLIST =
      '{"type":"action_proposal","action":"place_checklist","label":"Keep this as a checklist",' +
      '"checklist_title":"Getting started","checklist_items":["Run it locally","Open a PR"]}';

    /**
     * Every confirmed action that writes to the board, by its wire name: the five board-write
     * handles plus `claim_goal`, which writes twice — the claim, and the CURRENT_TASK card it
     * pins ("it's on your board too"). A table beats six near-identical tests drifting apart one
     * rename at a time.
     */
    const BOARD_WRITING_PROPOSALS: [string, string][] = [
      ["place_checklist", PLACE_CHECKLIST],
      [
        "amend_checklist",
        '{"type":"action_proposal","action":"amend_checklist","label":"Add that step",' +
          '"card_id":"c-1","checklist_title":"Getting started",' +
          '"checklist_items":["Run it locally","Open a PR","Ping the PM"]}',
      ],
      [
        "tick_checklist_items",
        '{"type":"action_proposal","action":"tick_checklist_items","label":"Tick those off",' +
          '"card_id":"c-1","checklist_items":["Run it locally"]}',
      ],
      [
        "reword_checklist_item",
        '{"type":"action_proposal","action":"reword_checklist_item","label":"Reword that step",' +
          '"card_id":"c-1","line_before":"Run it locally","line_after":"Run the app locally"}',
      ],
      [
        "place_note",
        '{"type":"action_proposal","action":"place_note","label":"Keep this as a note",' +
          '"note_text":"Deploys need the VPN."}',
      ],
      [
        "claim_goal",
        '{"type":"action_proposal","action":"claim_goal","label":"Work toward this task","task_id":"t-1"}',
      ],
    ];

    it.each(BOARD_WRITING_PROPOSALS)(
      "marks the board stale when a confirmed %s wrote a card",
      async (_action, proposal) => {
        const { client } = await confirmProposal(proposal, { ok: true, message: "Done." });

        expect(boardIsStale(client)).toBe(true);
      },
    );

    it("leaves the board alone when the action changed nothing", async () => {
      const { client } = await confirmProposal(PLACE_CHECKLIST, {
        ok: false,
        message: "I couldn't keep that just now.",
      });

      expect(boardIsStale(client)).toBe(false);
    });

    it("leaves the board alone for an action that never touches it", async () => {
      const { client } = await confirmProposal(
        '{"type":"action_proposal","action":"request_attestation","label":"Ask them to confirm this","title":"the auth fix","attester_id":"u-9"}',
        { ok: true, message: "Asked them to confirm it." },
      );

      expect(boardIsStale(client)).toBe(false);
    });

    /** Opens the session; each question asked answers with the next entry of `answers`. */
    async function openSession(answers: string[][]) {
      const { client, Wrapper } = boardContext();
      let answered = 0;
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
        http.post("/api/v1/onboarding/me/buddy/open/stream", () => silentGreeting()),
        http.post("/api/v1/onboarding/me/buddy/messages", () => stream(answers[answered++])),
      );

      const { result } = renderHook(() => useBuddy(), { wrapper: Wrapper });
      act(() => {
        result.current.toggleOpen();
      });
      await waitFor(() => expect(result.current.messages).toHaveLength(0));

      return { client, result };
    }

    /** Sends one question and waits for its turn to end. */
    async function ask(result: { current: ReturnType<typeof useBuddy> }, text: string) {
      act(() => {
        result.current.setDraft(text);
      });
      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      });
      await waitFor(() => expect(result.current.isThinking).toBe(false));
    }

    const PLACE_CARD_TURN = [
      '{"type":"tool_use","name":"place_card"}',
      '{"type":"token","content":"It is on your board."}',
      '{"type":"done"}',
    ];
    const METRICS_TURN = [
      '{"type":"tool_use","name":"get_my_metrics"}',
      '{"type":"token","content":"You are on track."}',
      '{"type":"done"}',
    ];

    /**
     * `place_card` is the one board write that is not confirmed — it applies the moment the
     * mentor runs it — so its `tool_use` event during the turn is the whole signal the client
     * gets that the board may have moved.
     */
    it("marks the board stale when the turn placed a card on it", async () => {
      const { client, result } = await openSession([PLACE_CARD_TURN]);

      await ask(result, "put the PR review task on my board");

      await waitFor(() => expect(boardIsStale(client)).toBe(true));
    });

    it("leaves the board alone when the turn ran other tools", async () => {
      const { client, result } = await openSession([METRICS_TURN, PLACE_CARD_TURN]);
      const invalidations = vi.spyOn(client, "invalidateQueries");

      await ask(result, "how am I doing?");
      await ask(result, "put the PR review task on my board");

      // Waiting for the *second* turn's sync closes the window: whatever the board-silent first
      // turn was going to do has happened by now, so a single invalidation proves the metrics
      // read marked nothing on its own.
      await waitFor(() => expect(boardIsStale(client)).toBe(true));
      expect(invalidations).toHaveBeenCalledTimes(1);
    });

    /** A reply that delivers its events and then drops — the failure lands after `place_card` ran. */
    function streamThenBreak(events: string[]) {
      const encoder = new TextEncoder();
      return new HttpResponse(
        new ReadableStream({
          async start(controller) {
            for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`));
            await delay(20);
            controller.error(new Error("connection lost"));
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }

    /**
     * The turn can fail after the tool already ran — the card is on the board either way, so the
     * sync must not wait for a clean finish. This is the "failing paths included" claim, pinned.
     */
    it("still marks the board stale when the turn broke after placing a card", async () => {
      const { client, result } = await openSession([]);
      server.use(
        http.post("/api/v1/onboarding/me/buddy/messages", () =>
          streamThenBreak(['{"type":"tool_use","name":"place_card"}']),
        ),
      );

      await ask(result, "put the PR review task on my board");

      await waitFor(() => expect(boardIsStale(client)).toBe(true));
    });
  });
});
