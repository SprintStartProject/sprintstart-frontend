import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../../../src/components/ui/useScrollLock";
import { useScrollRestoration } from "../../../src/hooks/useScrollRestoration";

function RestorablePage({ loaded }: { loaded: boolean }) {
  useScrollRestoration();

  return (
    <main
      {...{ [SCROLL_CONTAINER_ATTRIBUTE]: "" }}
      ref={(node) => {
        if (!node) return;
        node.scrollTo = (xOrOptions?: ScrollToOptions | number, y?: number) => {
          const target = typeof xOrOptions === "number" ? (y ?? 0) : (xOrOptions?.top ?? 0);
          const maximum = loaded ? 1_000 : 0;
          node.scrollTop = Math.min(maximum, target);
        };
      }}
    >
      {loaded ? <div>Loaded content tall enough to scroll</div> : <div>Loading</div>}
    </main>
  );
}

describe("useScrollRestoration", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("retries a POP restoration after asynchronous content grows", async () => {
    sessionStorage.setItem("sprintstart:scroll-positions", JSON.stringify({ prior: 700 }));

    const page = (loaded: boolean) => (
      <MemoryRouter initialEntries={[{ pathname: "/page", key: "prior" }]}>
        <RestorablePage loaded={loaded} />
      </MemoryRouter>
    );
    const { container, rerender } = render(page(false));
    const scrollHost = container.querySelector("main");

    expect(scrollHost?.scrollTop).toBe(0);

    rerender(page(true));

    await waitFor(() => expect(scrollHost?.scrollTop).toBe(700));
  });
});
