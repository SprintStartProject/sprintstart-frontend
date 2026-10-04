import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactPageSizeSelect } from "../../../../../src/features/knowledge-base/components/ArtifactPageSizeSelect.tsx";

describe("ArtifactPageSizeSelect", () => {
  it("offers 20, 50 and 100 behind a visible label", () => {
    render(<ArtifactPageSizeSelect pageSize={20} onPageSizeChange={vi.fn()} />);

    const select = screen.getByRole("combobox", { name: "Per page" });
    expect(select).toHaveTextContent("20");

    fireEvent.click(select);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["20", "50", "100"]);
  });

  it("reports the chosen size as a number", () => {
    const onPageSizeChange = vi.fn();
    render(<ArtifactPageSizeSelect pageSize={20} onPageSizeChange={onPageSizeChange} />);

    fireEvent.click(screen.getByTestId("kb-page-size"));
    fireEvent.click(screen.getByRole("option", { name: "50" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("shows a hand-edited size as its own option instead of misreporting it", () => {
    render(<ArtifactPageSizeSelect pageSize={35} onPageSizeChange={vi.fn()} />);

    const select = screen.getByTestId("kb-page-size");
    expect(select).toHaveTextContent("35");

    fireEvent.click(select);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "20",
      "35",
      "50",
      "100",
    ]);
  });
});
