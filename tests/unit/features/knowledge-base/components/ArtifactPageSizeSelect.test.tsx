import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactPageSizeSelect } from "../../../../../src/features/knowledge-base/components/ArtifactPageSizeSelect.tsx";

describe("ArtifactPageSizeSelect", () => {
  it("offers 20, 50 and 100 behind a visible label", () => {
    render(<ArtifactPageSizeSelect pageSize={20} onPageSizeChange={vi.fn()} />);

    const select = screen.getByLabelText("Per page");
    expect(select).toHaveValue("20");
    const values = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toEqual(["20", "50", "100"]);
  });

  it("reports the chosen size as a number", () => {
    const onPageSizeChange = vi.fn();
    render(<ArtifactPageSizeSelect pageSize={20} onPageSizeChange={onPageSizeChange} />);

    fireEvent.change(screen.getByTestId("kb-page-size"), { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("shows a hand-edited size as its own option instead of misreporting it", () => {
    render(<ArtifactPageSizeSelect pageSize={35} onPageSizeChange={vi.fn()} />);

    const select = screen.getByTestId<HTMLSelectElement>("kb-page-size");
    expect(select).toHaveValue("35");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["20", "35", "50", "100"]);
  });
});
