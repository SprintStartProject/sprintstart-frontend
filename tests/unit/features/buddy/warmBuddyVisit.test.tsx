import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";

/**
 * Warming the visit at widget mount.
 *
 * These live in their own file, and reset the module registry between tests, because the
 * thing under test is module-level state. `buddyService` remembers the warm-up promise for the
 * lifetime of the tab — deliberately, since a hire has one visit — so a second test in the same
 * module instance would see the first test's promise and send no request at all. That is the
 * behaviour being asserted; it just has to start from nothing each time.
 */
describe("warming the buddy visit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  /**
   * A fresh module instance per test, so the remembered warm-up starts empty.
   *
   * The provider has to come from the *same* fresh graph as the hook. `vi.resetModules()` gives
   * each dynamic import a new module registry, and a statically imported provider would hold a
   * different `BuddySessionContext` object — so the hook would look up a context nothing had
   * provided and throw.
   */
  async function freshBuddy() {
    const { useBuddy } = await import("../../../../src/features/buddy/hooks/useBuddy");
    const { BuddyProvider } = await import("../../../../src/features/buddy/BuddyProvider");
    return { useBuddy, BuddyProvider };
  }

  function countOpens() {
    const calls = { count: 0 };
    server.use(
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => {
        calls.count += 1;
        return new HttpResponse('data: {"type":"done"}\n\n', {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    return calls;
  }

  /**
   * The one request an unopened widget makes, and the exception is the point: writing the
   * greeting is the slow part of meeting the buddy, and the widget mounts app-wide the moment a
   * hire's session resolves — long before they click. Warming it there turns the click into the
   * replay path, which costs no model call at all.
   */
  it("opens the visit at mount, before the hire has clicked anything", async () => {
    const opens = countOpens();
    const { useBuddy, BuddyProvider } = await freshBuddy();

    renderHook(() => useBuddy(), { wrapper: BuddyProvider });

    await waitFor(() => {
      expect(opens.count).toBe(1);
    });
  });

  /**
   * `<React.StrictMode>` double-invokes effects in development, and two concurrent opens are
   * the read-then-write race in miniature. The backend is idempotent per visit so a duplicate
   * would be harmless rather than wrong — this simply declines to send it.
   */
  it("warms the visit once, not once per render", async () => {
    const opens = countOpens();
    const { useBuddy, BuddyProvider } = await freshBuddy();

    const { rerender } = renderHook(() => useBuddy(), { wrapper: BuddyProvider });
    rerender();
    rerender();

    await waitFor(() => {
      expect(opens.count).toBe(1);
    });
  });

  /**
   * The race this closes is real rather than theoretical: the widget is mounted on `/buddy`
   * too, so a hire landing straight there has the widget warming the visit while the page opens
   * it. Overlapping, both find no greeting and both spend a model call.
   *
   * Asserted as ordering, not as a request count, and the distinction is the whole point.
   * The backend answers a second open by replaying the greeting it already has — which is still
   * an HTTP request, just not a model call. So counting requests cannot tell the fixed case from
   * the broken one; only *"the second starts after the first finishes"* can.
   */
  it("makes a real open wait for a warm-up already in flight, rather than racing it", async () => {
    const events: string[] = [];
    let releaseFirst = () => {};
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let seen = 0;
    server.use(
      http.post("/api/v1/onboarding/me/buddy/open/stream", async () => {
        seen += 1;
        const which = seen;
        events.push(`start-${which}`);
        if (which === 1) await firstMayFinish;
        events.push(`end-${which}`);
        return new HttpResponse('data: {"type":"done"}\n\n', {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    const { warmBuddyVisit, streamOpenBuddy } =
      await import("../../../../src/services/buddyService");

    // Started together, exactly as the widget and the page would.
    const warming = warmBuddyVisit();
    const opening = streamOpenBuddy({ onToken: () => {}, onDone: () => {} });
    await waitFor(() => {
      expect(events).toContain("start-1");
    });
    // Nothing else may be in flight while the first is still open.
    expect(events).not.toContain("start-2");

    releaseFirst();
    await Promise.all([warming, opening]);

    expect(events).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  /**
   * Nobody asked for the warm-up and nobody is looking at it, so a failure has no audience.
   * The real open runs later and reports its own.
   */
  it("fails silently, leaving the widget usable", async () => {
    server.use(
      http.post("/api/v1/onboarding/me/buddy/open/stream", () => HttpResponse.error()),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
    );
    const { warmBuddyVisit } = await import("../../../../src/services/buddyService");

    await expect(warmBuddyVisit()).resolves.toBeUndefined();
  });
});
