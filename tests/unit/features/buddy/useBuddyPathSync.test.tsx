import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { announceBuddyPathChanged } from "../../../../src/features/buddy/aiBuddyBus";
import { useBuddyPathSync } from "../../../../src/features/buddy/hooks/useBuddyPathSync";
import { queryKeys } from "../../../../src/services/queryKeys";

describe("useBuddyPathSync", () => {
  it("marks the board and the onboarding status stale when the buddy changed the path", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useBuddyPathSync(), { wrapper });

    act(() => announceBuddyPathChanged());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.onboarding.myStatuses() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.board.all() });

    unmount();
    invalidate.mockClear();
    act(() => announceBuddyPathChanged());
    expect(invalidate).not.toHaveBeenCalled();
  });
});
