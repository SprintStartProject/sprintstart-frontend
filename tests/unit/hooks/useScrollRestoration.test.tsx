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

  it("does not reset scroll to 0 when search params change on the same pathname", async () => {
    const { useSearchParams } = await import("react-router-dom");
    const { default: userEvent } = await import("@testing-library/user-event");
    const { screen } = await import("@testing-library/react");

    function SearchParamsPage() {
      useScrollRestoration();
      const [searchParams, setSearchParams] = useSearchParams();
      return (
        <main
          {...{ [SCROLL_CONTAINER_ATTRIBUTE]: "" }}
          ref={(node) => {
            if (!node) return;
            node.scrollTo = (xOrOptions?: ScrollToOptions | number, y?: number) => {
              const target = typeof xOrOptions === "number" ? (y ?? 0) : (xOrOptions?.top ?? 0);
              node.scrollTop = target;
            };
          }}
        >
          <span data-testid="artifact-param">{searchParams.get("artifact") ?? ""}</span>
          <button
            data-testid="open-btn"
            onClick={() => setSearchParams({ artifact: "art-1" }, { replace: true })}
          >
            Open
          </button>
          <button data-testid="close-btn" onClick={() => setSearchParams({}, { replace: true })}>
            Close
          </button>
        </main>
      );
    }

    const { container } = render(
      <MemoryRouter initialEntries={["/knowledge-base"]}>
        <SearchParamsPage />
      </MemoryRouter>,
    );

    const scrollHost = container.querySelector("main")!;
    // Simulate user scrolled down
    scrollHost.scrollTop = 500;

    // User opens artifact
    const openBtn = screen.getByTestId("open-btn");
    await userEvent.click(openBtn);

    expect(screen.getByTestId("artifact-param")).toHaveTextContent("art-1");
    expect(scrollHost.scrollTop).toBe(500);

    // User closes artifact
    const closeBtn = screen.getByTestId("close-btn");
    await userEvent.click(closeBtn);

    expect(screen.getByTestId("artifact-param")).toHaveTextContent("");
    expect(scrollHost.scrollTop).toBe(500);
  });
});
