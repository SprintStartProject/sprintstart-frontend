/**
 * Consumer side of the buddy stream contract.
 *
 * The backend owns `contracts/buddy-stream-events.schema.json` and its examples; this repository keeps a
 * copy (`scripts/quality/contracts-sync.sh` fails while it differs). Every example is streamed through
 * the real service functions, so an event the backend sends that this UI cannot read fails here instead
 * of silently disappearing from a hire's conversation.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamMessage, streamOpenBuddy } from "../../../src/services/buddyService";
import { mockKeycloakInstance, server } from "../setup/vitest.setup";

type BuddyEvent = {
  type: string;
  proposal_id?: string;
  content?: string;
  reasoning?: string;
  name?: string;
  message?: string;
  label?: string;
  artifact_id?: string;
};

/** What the handler must receive, for the events whose payload is a single value or a known field. */
function expectedArgument(event: BuddyEvent): unknown {
  const byType: Record<string, unknown> = {
    token: event.content,
    reasoning: event.reasoning,
    tool_use: event.name,
    error: event.message,
    opening_action: expect.objectContaining({ label: event.label }),
    citation: expect.objectContaining({ artifactId: event.artifact_id }),
  };
  return byType[event.type];
}

const CONTRACTS = join(__dirname, "../../../contracts");
const schema = JSON.parse(
  readFileSync(join(CONTRACTS, "buddy-stream-events.schema.json"), "utf8"),
) as {
  oneOf: { properties: { type: { const: string } } }[];
};
const examples = readdirSync(join(CONTRACTS, "examples/buddy-stream"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    event: JSON.parse(
      readFileSync(join(CONTRACTS, "examples/buddy-stream", name), "utf8"),
    ) as BuddyEvent,
  }));

/** Which handler must fire for an event, and which endpoint sends it. */
function expectation(event: BuddyEvent): { handler: string; opening: boolean } {
  if (event.type === "opening_action") return { handler: "onAction", opening: true };
  if (event.type === "action_proposal") {
    return { handler: event.proposal_id ? "onStoredProposal" : "onActionProposal", opening: false };
  }
  const handlers: Record<string, string> = {
    token: "onToken",
    reasoning: "onReasoning",
    tool_use: "onToolUse",
    citation: "onCitation",
    reset: "onReset",
    done: "onDone",
    error: "onError",
  };
  return { handler: handlers[event.type], opening: false };
}

function streamOf(...events: BuddyEvent[]): HttpResponse<ReadableStream> {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
}

async function deliver(
  event: BuddyEvent,
  opening: boolean,
): Promise<Record<string, ReturnType<typeof vi.fn>>> {
  const terminal = event.type === "done" || event.type === "error";
  const events = terminal ? [event] : [event, { type: "done" }];
  const handlers = Object.fromEntries(
    [
      "onToken",
      "onReasoning",
      "onToolUse",
      "onCitation",
      "onReset",
      "onDone",
      "onError",
      "onAction",
    ]
      .concat(["onActionProposal", "onStoredProposal"])
      .map((name) => [name, vi.fn()]),
  );
  if (opening) {
    server.use(http.post("/api/v1/onboarding/me/buddy/open/stream", () => streamOf(...events)));
    await streamOpenBuddy(handlers as never, "session-1");
  } else {
    server.use(http.post("/api/v1/onboarding/me/buddy/messages", () => streamOf(...events)));
    await streamMessage("hello", handlers as never, "session-1");
  }
  return handlers;
}

describe("buddy stream contract (consumer)", () => {
  beforeEach(() => {
    mockKeycloakInstance.authenticated = true;
    mockKeycloakInstance.token = "test-token";
    mockKeycloakInstance.updateToken.mockResolvedValue(true);
  });

  it("has an example for every event type in the schema", () => {
    const types = new Set(schema.oneOf.map((branch) => branch.properties.type.const));

    expect(new Set(examples.map((example) => example.event.type))).toEqual(types);
  });

  it.each(examples)("$name follows the schema", ({ event }) => {
    const validate = new Ajv2020({ strict: false }).compile(schema);

    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(examples)("$name reaches its handler", async ({ event }) => {
    const { handler, opening } = expectation(event);

    const handlers = await deliver(event, opening);

    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    const argument = expectedArgument(event);
    if (argument !== undefined) expect(handlers[handler]).toHaveBeenCalledWith(argument);
    if (event.type !== "error") expect(handlers.onError).not.toHaveBeenCalled();
  });
});
