import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const MESSAGES = "/api/v1/onboarding/me/buddy/messages";
const OPEN = "/api/v1/onboarding/me/buddy/open/stream";

type SentBody = Record<string, unknown>;

function replyStream(text: string) {
  const encoder = new TextEncoder();
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: {"type":"token","content":"${text}"}\n\n`));
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

/**
 * The options the composer attaches to a message — the mentor switch and the session filters.
 * `filterRange.test.ts` pins the conversion of the dates; this pins that the values reach the
 * wire, and that the switch is remembered per user with the right default.
 *
 * The send is served by MSW rather than by a held-open stream (see the queue suite for that):
 * none of these cases depends on a turn being in flight, so each reply may simply finish.
 */
describe("buddy message options", () => {
  let bodies: SentBody[] = [];

  const originalTz = process.env.TZ;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    bodies = [];
    localStorage.clear();

    // A fixed zone with daylight saving, like `filterRange.test.ts`: the wire instants for a
    // chosen day depend on the zone the composer runs in.
    process.env.TZ = "Europe/Berlin";

    server.use(
      http.get(MESSAGES, () => HttpResponse.json([])),
      http.post(OPEN, () => replyStream("Hello!")),
      http.post(MESSAGES, async ({ request }) => {
        bodies.push((await request.json()) as SentBody);
        return replyStream("Answer");
      }),
    );
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  /** Mounts the session with its opening settled, so the composer is free to send. */
  async function mount() {
    const rendered = renderHook(() => useBuddy(), { wrapper: BuddyProviderWithStubs });
    await waitFor(() => expect(rendered.result.current.messages).toHaveLength(1));
    await waitFor(() => expect(rendered.result.current.isGreeting).toBe(false));
    return rendered;
  }

  async function sendAndAwait(
    result: { current: ReturnType<typeof useBuddy> },
    count: number,
    text: string,
  ) {
    act(() => {
      result.current.submitMessage(text);
    });
    await waitFor(() => expect(bodies).toHaveLength(count));
  }

  it("sends the mentor switch on by default", async () => {
    const { result } = await mount();

    await sendAndAwait(result, 1, "Q1");

    expect(bodies[0].capabilitiesEnabled).toBe(true);
  });

  it("remembers an explicit off per user and sends it", async () => {
    const first = await mount();

    act(() => {
      first.result.current.setCapabilitiesEnabled(false);
    });
    expect(localStorage.getItem("buddyMentorTools:user-1")).toBe("false");

    await sendAndAwait(first.result, 1, "Q1");
    expect(bodies[0].capabilitiesEnabled).toBe(false);

    // A fresh session for the same user reads the switch back.
    first.unmount();
    const again = await mount();
    await waitFor(() => expect(again.result.current.capabilitiesEnabled).toBe(false));

    await sendAndAwait(again.result, 2, "Q2");
    expect(bodies[1].capabilitiesEnabled).toBe(false);
  });

  it("sends the session filters as local day boundaries", async () => {
    const { result } = await mount();

    act(() => {
      result.current.setFilters({
        sourceSystems: ["GITHUB"],
        from: "2026-01-15",
        to: "2026-01-16",
      });
    });

    await sendAndAwait(result, 1, "Q1");

    expect(bodies[0].filters).toEqual({
      source_systems: ["GITHUB"],
      time_from: "2026-01-14T23:00:00.000Z",
      time_to: "2026-01-16T22:59:59.999Z",
    });
  });

  it("sends no filters when none are set", async () => {
    const { result } = await mount();

    await sendAndAwait(result, 1, "Q1");

    expect(bodies[0]).not.toHaveProperty("filters");
  });
});
