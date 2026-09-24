import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMessages,
  performAction,
  streamMessage,
  streamOpenBuddy,
  confirmStoredProposal,
  dismissStoredProposal,
} from "../../../src/services/buddyService";
import { http, HttpResponse } from "msw";
import { mockKeycloakInstance, server } from "../../unit/setup/vitest.setup";

describe("buddyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKeycloakInstance.authenticated = true;
    mockKeycloakInstance.token = "test-token";
    mockKeycloakInstance.updateToken.mockResolvedValue(true);
  });

  describe("getMessages", () => {
    it("returns the buddy conversation as a bare array", async () => {
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", () =>
          HttpResponse.json([
            { role: "USER", content: "hi", createdAt: "2026-07-18T00:00:00.000Z" },
            { role: "ASSISTANT", content: "hello!", createdAt: "2026-07-18T00:00:01.000Z" },
          ]),
        ),
      );

      const result = await getMessages();
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("USER");
      expect(result[1].content).toBe("hello!");
    });
  });

  describe("streamMessage", () => {
    it("receives tokens and done signal", async () => {
      let capturedAuthHeader: string | null = null;
      let capturedBody: unknown = null;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"token","content":"hel"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"token","content":"lo"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post("/api/v1/onboarding/me/buddy/messages", async ({ request }) => {
          capturedAuthHeader = request.headers.get("Authorization");
          capturedBody = await request.json();
          return new HttpResponse(stream, {
            headers: { "Content-Type": "text/event-stream" },
          });
        }),
      );

      const onToken = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      await streamMessage("hello", { onToken, onCitation: vi.fn(), onDone, onError });

      expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
      expect(capturedAuthHeader).toBe("Bearer test-token");
      expect(capturedBody).toEqual({ content: "hello" });
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, "hel");
      expect(onToken).toHaveBeenNthCalledWith(2, "lo");
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("calls login and skips streaming if token refresh fails", async () => {
      let messageSent = false;
      mockKeycloakInstance.updateToken.mockRejectedValueOnce(new Error("Refresh failed"));

      server.use(
        http.post("/api/v1/onboarding/me/buddy/messages", () => {
          messageSent = true;
          return new HttpResponse(null, { status: 200 });
        }),
      );

      await streamMessage("hello", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
      });

      expect(mockKeycloakInstance.login).toHaveBeenCalledOnce();
      expect(messageSent).toBe(false);
    });

    /**
     * The framing tolerates a line it cannot read, the way the backend does and the way
     * `aiStreamService` does with the identical wire format. One unparseable `data:` line — a
     * keep-alive, a proxy writing its own text, a truncated tail — used to throw out of the read
     * loop and take the rest of the reply with it.
     */
    it("skips a chunk it cannot parse instead of losing the reply", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"token","content":"hel"}\n\n'));
          controller.enqueue(encoder.encode("data: not json at all\n\n"));
          controller.enqueue(encoder.encode('data: {"type":"token","content":"lo"}\n\n'));
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () => new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } }),
        ),
      );

      const onToken = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      await streamMessage("hello", { onToken, onCitation: vi.fn(), onDone, onError });

      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(2, "lo");
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    /**
     * Never reaching the server is a failure the caller has to be able to show, so it arrives at
     * `onError` as a sentence rather than as a rejection out of the call.
     */
    it("reports a transport failure instead of rejecting", async () => {
      server.use(http.post("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.error()));

      const onDone = vi.fn();
      const onError = vi.fn();

      await expect(
        streamMessage("hello", { onToken: vi.fn(), onCitation: vi.fn(), onDone, onError }),
      ).resolves.toBeUndefined();

      expect(onError).toHaveBeenCalledTimes(1);
      // Nothing arrived, so nothing is finished: announcing completion here would tell the
      // surface to render an answer that does not exist.
      expect(onDone).not.toHaveBeenCalled();
    });

    it("calls onError when response is not ok", async () => {
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const onError = vi.fn();
      await streamMessage("hello", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onError,
      });

      expect(onError).toHaveBeenCalledWith("HTTP error! status: 500");
    });

    it("processes citation events", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"citation","artifact_id":"a1","filename":"doc.txt","start_line":5}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onCitation = vi.fn();
      const onDone = vi.fn();

      await streamMessage("hello", {
        onToken: vi.fn(),
        onCitation,
        onDone,
      });

      expect(onCitation).toHaveBeenCalledWith({
        artifactId: "a1",
        filename: "doc.txt",
        sourceUrl: undefined,
        startLine: 5,
        startPage: undefined,
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("handles stream error event", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"type":"error","message":"Model overload"}\n\n'),
          );
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onError = vi.fn();
      await streamMessage("hello", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onError,
      });

      expect(onError).toHaveBeenCalledWith("Model overload");
    });

    it("surfaces an action proposal without mutating anything", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"claim_goal","label":"Work toward this task"}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode('data: {"type":"token","content":"Confirm below."}\n\n'),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onActionProposal = vi.fn();
      await streamMessage("help me start my first task", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onActionProposal,
      });

      expect(onActionProposal).toHaveBeenCalledWith({
        action: "claim_goal",
        label: "Work toward this task",
        question: undefined,
        taskId: undefined,
      });
    });

    it("maps a proposal's snake_case confirm payloads to camelCase", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"claim_goal","label":"Claim this task","task_id":"t-1"}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"request_attestation","label":"Ask them to confirm this","title":"the auth fix","attester_id":"u-9"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onActionProposal = vi.fn();
      await streamMessage("let me try that", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onActionProposal,
      });

      expect(onActionProposal).toHaveBeenNthCalledWith(1, {
        action: "claim_goal",
        label: "Claim this task",
        question: undefined,
        taskId: "t-1",
        title: undefined,
        attesterId: undefined,
        githubLogin: undefined,
        competencyKey: undefined,
        level: undefined,
      });
      expect(onActionProposal).toHaveBeenNthCalledWith(2, {
        action: "request_attestation",
        label: "Ask them to confirm this",
        question: undefined,
        taskId: undefined,
        title: "the auth fix",
        attesterId: "u-9",
        githubLogin: undefined,
        competencyKey: undefined,
        level: undefined,
      });
    });

    /**
     * Both fields have to survive the stream. A confirmed `request_attestation` that reaches
     * the server without them has nothing to act on and comes back as "I need to know what
     * work to confirm and who to ask" — reading like a precondition the hire failed rather
     * than a wire that drops fields.
     */
    it("maps the attestation and username payloads too", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"request_attestation","label":"Ask them to confirm this","title":"Facilitated the retro","attester_id":"u-9"}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"set_github_login","label":"Save this username","github_login":"octocat"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onActionProposal = vi.fn();
      await streamMessage("can Ana confirm my retro?", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onActionProposal,
      });

      expect(onActionProposal).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ title: "Facilitated the retro", attesterId: "u-9" }),
      );
      expect(onActionProposal).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ githubLogin: "octocat" }),
      );
    });

    /**
     * The level is a judgement about the hire's own skill, shown on the button they click. If
     * either field is dropped on the way through, the confirm reaches the server with nothing to
     * record and comes back as a polite refusal — indistinguishable, to the hire, from the mentor
     * changing its mind.
     */
    it("maps the placement payload", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","action":"record_assessment","label":"Save: Kotlin — intermediate","competency_key":"kotlin","level":"intermediate"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });

      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () =>
            new HttpResponse(stream, {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const onActionProposal = vi.fn();
      await streamMessage("where do I stand?", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onActionProposal,
      });

      expect(onActionProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "record_assessment",
          label: "Save: Kotlin — intermediate",
          competencyKey: "kotlin",
          level: "intermediate",
        }),
      );
    });
  });

  describe("performAction", () => {
    it("confirms an action and returns the outcome", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post("/api/v1/onboarding/me/buddy/actions", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ ok: true, message: "You are now working toward it." });
        }),
      );

      const result = await performAction("claim_goal");

      expect(result).toEqual({ ok: true, message: "You are now working toward it." });
      expect(capturedBody).toMatchObject({ action: "claim_goal" });
    });

    it("sends the composed question for a flag-to-PM confirmation", async () => {
      let capturedBody: { action?: string; question?: string } = {};
      server.use(
        http.post("/api/v1/onboarding/me/buddy/actions", async ({ request }) => {
          capturedBody = (await request.json()) as { action?: string; question?: string };
          return HttpResponse.json({ ok: true, message: "Flagged to your PM." });
        }),
      );

      await performAction("flag_to_pm", { question: "How do we deploy?" });

      expect(capturedBody.action).toBe("flag_to_pm");
      expect(capturedBody.question).toBe("How do we deploy?");
    });

    it("echoes the confirm payloads the proposal carried", async () => {
      let capturedBody: Record<string, unknown> = {};
      server.use(
        http.post("/api/v1/onboarding/me/buddy/actions", async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true, message: "Done." });
        }),
      );

      await performAction("claim_goal", { taskId: "t-1" });
      expect(capturedBody).toMatchObject({ action: "claim_goal", taskId: "t-1" });

      await performAction("request_attestation", { title: "the auth fix", attesterId: "u-9" });
      expect(capturedBody).toMatchObject({
        action: "request_attestation",
        title: "the auth fix",
        attesterId: "u-9",
      });

      await performAction("record_assessment", { competencyKey: "kotlin", level: "intermediate" });
      expect(capturedBody).toMatchObject({
        action: "record_assessment",
        competencyKey: "kotlin",
        level: "intermediate",
      });
    });
  });

  describe("team mode", () => {
    it("reads the team conversation under the teamProjectId query param", async () => {
      let capturedUrl = "";
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
          capturedUrl = new URL(request.url).search;
          return HttpResponse.json([{ role: "ASSISTANT", content: "team hello" }]);
        }),
      );

      const result = await getMessages("p-123");

      expect(result[0].content).toBe("team hello");
      expect(capturedUrl).toBe("?teamProjectId=p-123");
    });

    it("reads the hire conversation without any query param", async () => {
      let capturedUrl = "";
      server.use(
        http.get("/api/v1/onboarding/me/buddy/messages", ({ request }) => {
          capturedUrl = new URL(request.url).search;
          return HttpResponse.json([]);
        }),
      );

      await getMessages();

      expect(capturedUrl).toBe("");
    });

    it("sends teamProjectId on the message body, never as null", async () => {
      let capturedBody: Record<string, unknown> = {};
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      server.use(
        http.post("/api/v1/onboarding/me/buddy/messages", async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
        }),
      );

      await streamMessage(
        "who is behind?",
        { onToken: vi.fn(), onCitation: vi.fn(), onDone: vi.fn() },
        "p-123",
      );

      expect(capturedBody).toEqual({ content: "who is behind?", teamProjectId: "p-123" });
    });

    it("opens the team greeting under the teamProjectId query param", async () => {
      let capturedUrl = "";
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      server.use(
        http.post("/api/v1/onboarding/me/buddy/open/stream", ({ request }) => {
          capturedUrl = new URL(request.url).search;
          return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
        }),
      );

      await streamOpenBuddy({ onToken: vi.fn(), onDone: vi.fn() }, "p-123");

      expect(capturedUrl).toBe("?teamProjectId=p-123");
    });

    it("surfaces a stored proposal from the stream with its risk", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","proposal_id":"prop-1","label":"Shift Task 0","preview":"Jonas takes Task 0.","risk":"DESTRUCTIVE"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () => new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } }),
        ),
      );

      const onStoredProposal = vi.fn();
      const onActionProposal = vi.fn();
      await streamMessage("change the plan", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onActionProposal,
        onStoredProposal,
      });

      expect(onStoredProposal).toHaveBeenCalledWith({
        proposalId: "prop-1",
        label: "Shift Task 0",
        preview: "Jonas takes Task 0.",
        risk: "DESTRUCTIVE",
      });
      // A stored offer is not a hire offer: the tool-name echo must stay silent.
      expect(onActionProposal).not.toHaveBeenCalled();
    });

    it("fails closed to null risk for an unknown value, and says so on the console", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","proposal_id":"prop-2","label":"x","preview":"y","risk":"COSMIC"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () => new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } }),
        ),
      );

      const onStoredProposal = vi.fn();
      await streamMessage("m", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onStoredProposal,
      });

      expect(onStoredProposal).toHaveBeenCalledWith(
        expect.objectContaining({ risk: null, preview: "y" }),
      );
      expect(warn).toHaveBeenCalledWith("Buddy sent an unknown proposal risk: COSMIC");
      warn.mockRestore();
    });

    it("carries an absent preview as null instead of an invisible empty string", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"type":"action_proposal","proposal_id":"prop-3","label":"x","risk":"BULK"}\n\n',
            ),
          );
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/messages",
          () => new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } }),
        ),
      );

      const onStoredProposal = vi.fn();
      await streamMessage("m", {
        onToken: vi.fn(),
        onCitation: vi.fn(),
        onDone: vi.fn(),
        onStoredProposal,
      });

      expect(onStoredProposal).toHaveBeenCalledWith(
        expect.objectContaining({ preview: null, risk: "BULK" }),
      );
      warn.mockRestore();
    });

    it("confirms a stored proposal by id alone", async () => {
      let capturedUrl = "";
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/prop-9/confirm", ({ request }) => {
          capturedUrl = new URL(request.url).pathname;
          return HttpResponse.json({ ok: true, message: "Task 0 reassigned." });
        }),
      );

      const result = await confirmStoredProposal("prop-9");

      expect(result).toEqual({ ok: true, message: "Task 0 reassigned." });
      expect(capturedUrl).toBe("/api/v1/onboarding/me/buddy/proposals/prop-9/confirm");
    });

    it("dismisses a stored proposal by id alone", async () => {
      server.use(
        http.post("/api/v1/onboarding/me/buddy/proposals/prop-9/dismiss", () =>
          HttpResponse.json({ ok: true, message: "Nothing changed." }),
        ),
      );

      const result = await dismissStoredProposal("prop-9");

      expect(result).toEqual({ ok: true, message: "Nothing changed." });
    });

    it("lets the 404 of an already-settled proposal surface as a rejection", async () => {
      server.use(
        http.post(
          "/api/v1/onboarding/me/buddy/proposals/prop-9/confirm",
          () => new HttpResponse(null, { status: 404 }),
        ),
      );

      // The hook maps this to the outcome line; the service's job is only to fail visibly.
      await expect(confirmStoredProposal("prop-9")).rejects.toThrow();
    });
  });
});
