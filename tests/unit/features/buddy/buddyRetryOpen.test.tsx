import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { useBuddy } from "../../../../src/features/buddy/hooks/useBuddy";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";
import { BuddyTestProviders } from "./buddyTestHarness";
import { server } from "../../setup/vitest.setup";

const SESSIONS = "/api/v1/onboarding/me/buddy/sessions";
const MESSAGES = "/api/v1/onboarding/me/buddy/messages";

const row = (id: string, title: string, createdAt: string) => ({
  id,
  title,
  userId: "1",
  projectId: null,
  createdAt,
});

describe("Try again after a failed new conversation", () => {
  let reads = 0;
  let creates = 0;

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    reads = 0;
    creates = 0;
    server.use(
      http.get(SESSIONS, () => {
        reads += 1;
        return HttpResponse.json({ sessions: [row("s1", "First", "2026-10-01T09:00:00.000Z")] });
      }),
      http.get(MESSAGES, () => HttpResponse.json([])),
      http.post(SESSIONS, () => {
        creates += 1;
        return creates === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ id: "s-new" }, { status: 201 });
      }),
    );
  });

  it("redoes the create itself, not the opening read", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BuddyTestProviders>
        <BuddyProvider>{children}</BuddyProvider>
      </BuddyTestProviders>
    );
    const { result } = renderHook(() => useBuddy(), { wrapper });
    await waitFor(() => expect(result.current.currentSessionId).toBe("s1"));

    await act(async () => {
      await result.current.newConversation();
    });
    expect(result.current.openError).not.toBeNull();
    expect(creates).toBe(1);

    await act(async () => {
      await result.current.retryOpen();
    });

    expect(creates).toBe(2);
    expect(reads).toBe(1);
    expect(result.current.openError).toBeNull();
    expect(result.current.currentSessionId).toBe("s-new");

    // The move was consumed: a further retry is the plain opening read again.
    await act(async () => {
      await result.current.retryOpen();
    });
    expect(creates).toBe(2);
  });
});
