import { act, renderHook, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import type { BuddySessionSummary } from "../../../../src/services/buddyService";
import { queryKeys } from "../../../../src/services/queryKeys";
import { BuddyProviderWithStubs } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const SESSIONS = "/api/v1/onboarding/me/buddy/sessions";

function session(id: string, title: string): BuddySessionSummary {
  return { id, title, projectId: null, createdAt: "2026-09-30T09:00:00.000Z" };
}

/** The session and what the query cache holds under the dashboard card's key, in one render. */
function useSessionAndCache() {
  const buddy = useBuddy();
  const cached = useQueryClient().getQueryData<BuddySessionSummary[]>(queryKeys.buddy.sessions());

  return { buddy, cached };
}

/**
 * The dashboard's "Recent conversations" card reads the hire's list from the query cache. The
 * session writes every change through to it — without that, a conversation just binned stayed
 * listed (and its link bounced) for as long as the cached read was fresh.
 */
describe("the conversation list in the query cache", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    server.use(
      http.get(SESSIONS, () =>
        HttpResponse.json({
          sessions: [session("s1", "First"), session("s2", "Second")],
        }),
      ),
      http.get("/api/v1/onboarding/me/buddy/messages", () => HttpResponse.json([])),
      http.delete(`${SESSIONS}/:sessionId`, () => new HttpResponse(null, { status: 204 })),
    );
  });

  it("holds what the session read, and follows a bin", async () => {
    const { result } = renderHook(() => useSessionAndCache(), {
      wrapper: BuddyProviderWithStubs,
    });

    await waitFor(() => expect(result.current.cached?.map((row) => row.id)).toEqual(["s1", "s2"]));

    await act(async () => {
      await result.current.buddy.binSession("s2");
    });

    await waitFor(() => expect(result.current.cached?.map((row) => row.id)).toEqual(["s1"]));
  });

  it("puts a new conversation in front", async () => {
    const { result } = renderHook(() => useSessionAndCache(), {
      wrapper: BuddyProviderWithStubs,
    });
    await waitFor(() => expect(result.current.buddy.isOpening).toBe(false));
    await waitFor(() => expect(result.current.cached).toHaveLength(2));

    await act(async () => {
      await result.current.buddy.newConversation();
    });

    // The default create handler answers `session-new`.
    await waitFor(() => expect(result.current.cached?.[0]?.id).toBe("session-new"));
  });
});
