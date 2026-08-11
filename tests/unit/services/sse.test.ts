import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../../../src/services/sse";

function makeStream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("parseSSEStream", () => {
  it("yields parsed JSON events from data: lines", async () => {
    const stream = makeStream(
      'data: {"type":"token","content":"hello"}\n\n',
      'data: {"type":"token","content":"world"}\n\n',
      'data: {"type":"done"}\n\n',
    );

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "token", content: "hello" },
      { type: "token", content: "world" },
      { type: "done" },
    ]);
  });

  it("handles multi-byte UTF-8 split across chunks", async () => {
    // 'é' is 2 bytes in UTF-8: 0xC3 0xA9
    const encoder = new TextEncoder();
    const full = encoder.encode('data: {"type":"token","content":"café"}\n\n');

    // Split in the middle of the multi-byte character
    const first = full.slice(0, 30);
    const second = full.slice(30);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(second);
        controller.close();
      },
    });

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "token", content: "café" }]);
  });

  it("buffers partial lines across chunks", async () => {
    const stream = makeStream(
      'data: {"type":"toke', // partial
      'n","content":"hi"}\n\n', // completion
      'data: {"type":"done"}\n\n',
    );

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "token", content: "hi" }, { type: "done" }]);
  });

  it("skips malformed JSON lines without aborting", async () => {
    const stream = makeStream(
      "data: not valid json\n\n",
      'data: {"type":"token","content":"good"}\n\n',
      "data: {broken\n\n",
      'data: {"type":"done"}\n\n',
    );

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    // Only the valid lines make it through
    expect(events).toEqual([{ type: "token", content: "good" }, { type: "done" }]);
  });

  it("skips non-data lines (comments, blank lines)", async () => {
    const stream = makeStream(
      ": keep-alive comment\n\n",
      'data: {"type":"token","content":"ok"}\n\n',
      "\n",
      'data: {"type":"done"}\n\n',
    );

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "token", content: "ok" }, { type: "done" }]);
  });

  it("skips empty data: lines", async () => {
    const stream = makeStream("data:\n\n", 'data: {"type":"done"}\n\n');

    const events: { type: string }[] = [];
    for await (const event of parseSSEStream<{ type: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "done" }]);
  });

  it("completes gracefully when stream ends with partial line in buffer", async () => {
    const stream = makeStream(
      'data: {"type":"token","content":"hi"}\n\n',
      'data: {"type":"partial", "cont', // no newline — stays in buffer
    );

    const events: { type: string; content?: string }[] = [];
    for await (const event of parseSSEStream<{ type: string; content?: string }>(stream)) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "token", content: "hi" }]);
  });
});
