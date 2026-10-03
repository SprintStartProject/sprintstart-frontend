import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "../../../../src/components/ui/Pagination";

/** The strip as a reader sees it, e.g. `1 ... 4 5 6 ... 20`, without the prev/next arrows. */
function visibleStrip(): string {
  const nav = screen.getByRole("navigation", { name: "Pagination" });
  const numbered = nav.querySelector("div") as HTMLElement;
  return Array.from(numbered.children)
    .map((child) => child.textContent?.trim())
    .join(" ");
}

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every page number up to seven pages", () => {
    render(<Pagination currentPage={4} totalPages={7} onPageChange={vi.fn()} />);
    expect(visibleStrip()).toBe("1 2 3 4 5 6 7");
  });

  it("keeps the first and last page and the current page with its neighbours", () => {
    render(<Pagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />);
    expect(visibleStrip()).toBe("1 ... 9 10 11 ... 20");
  });

  it("collapses only the far side near the start", () => {
    render(<Pagination currentPage={2} totalPages={20} onPageChange={vi.fn()} />);
    expect(visibleStrip()).toBe("1 2 3 4 5 ... 20");
  });

  it("collapses only the far side near the end", () => {
    render(<Pagination currentPage={19} totalPages={20} onPageChange={vi.fn()} />);
    expect(visibleStrip()).toBe("1 ... 16 17 18 19 20");
  });

  it("never hides a single page behind an ellipsis", () => {
    render(<Pagination currentPage={5} totalPages={8} onPageChange={vi.fn()} />);
    expect(visibleStrip()).toBe("1 ... 4 5 6 7 8");
  });

  it("marks the current page and reports clicks on another one", async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={10} totalPages={20} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "10" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("button", { name: "20" }));
    expect(onPageChange).toHaveBeenCalledWith(20);
  });
});
