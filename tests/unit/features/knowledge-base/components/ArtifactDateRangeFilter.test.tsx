import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactDateRangeFilter } from "../../../../../src/features/knowledge-base/components/ArtifactDateRangeFilter.tsx";
import type { DateRange } from "../../../../../src/features/knowledge-base/dateRange.ts";

const NOW = new Date("2026-09-24T10:00:00Z");
const OPEN: DateRange = { from: null, to: null };

function renderFilter(range: DateRange = OPEN) {
  const onRangeChange = vi.fn();
  const view = render(
    <ArtifactDateRangeFilter range={range} onRangeChange={onRangeChange} now={NOW} />,
  );
  return { onRangeChange, ...view };
}

describe("ArtifactDateRangeFilter", () => {
  it("resolves a preset to absolute dates when it is picked, and pushes it", () => {
    const { onRangeChange } = renderFilter();

    fireEvent.change(screen.getByTestId("kb-date-preset"), { target: { value: "7d" } });

    expect(onRangeChange).toHaveBeenCalledWith({ from: "2026-09-18", to: "2026-09-24" }, "push");
  });

  it("shows the preset a range still equals, and Custom once it does not", () => {
    const { rerender } = renderFilter({ from: "2026-09-18", to: "2026-09-24" });
    expect(screen.getByTestId("kb-date-preset")).toHaveValue("7d");

    rerender(
      <ArtifactDateRangeFilter
        range={{ from: "2026-01-01", to: "2026-02-01" }}
        onRangeChange={vi.fn()}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("kb-date-preset")).toHaveValue("CUSTOM");
    expect(screen.getByTestId("kb-date-from")).toHaveValue("2026-01-01");
  });

  it("reveals two date fields for a custom range and replaces on each edit", () => {
    const { onRangeChange } = renderFilter();

    fireEvent.change(screen.getByTestId("kb-date-preset"), { target: { value: "CUSTOM" } });
    expect(onRangeChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Added from"), { target: { value: "2026-09-01" } });
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-09-01", to: null }, "replace");
  });

  it("refuses a reversed custom range with a message instead of writing it", () => {
    const { onRangeChange } = renderFilter({ from: "2026-09-10", to: null });

    fireEvent.change(screen.getByLabelText("Added to"), { target: { value: "2026-09-01" } });

    expect(onRangeChange).not.toHaveBeenCalled();
    const error = screen.getByTestId("kb-date-error");
    expect(error).toHaveTextContent("on or before");
    expect(screen.getByLabelText("Added to")).toHaveAttribute("aria-describedby", error.id);
    expect(screen.getByLabelText("Added to")).toHaveAttribute("aria-invalid", "true");
  });

  it("names the active range in a chip whose button clears it", () => {
    const { onRangeChange } = renderFilter({ from: "2026-09-01", to: null });

    expect(screen.getByTestId("kb-date-chip")).toHaveTextContent(/Added since/);
    fireEvent.click(screen.getByRole("button", { name: "Clear date range" }));

    expect(onRangeChange).toHaveBeenCalledWith({ from: null, to: null }, "push");
  });

  it("shows no chip and Any time while no range is set", () => {
    renderFilter();
    expect(screen.getByTestId("kb-date-preset")).toHaveValue("ANY");
    expect(screen.queryByTestId("kb-date-chip")).not.toBeInTheDocument();
  });

  it("goes back to Any time when the range is cleared from outside", () => {
    const { rerender } = renderFilter({ from: "2026-01-01", to: "2026-02-01" });
    expect(screen.getByTestId("kb-date-preset")).toHaveValue("CUSTOM");

    rerender(<ArtifactDateRangeFilter range={OPEN} onRangeChange={vi.fn()} now={NOW} />);

    expect(screen.getByTestId("kb-date-preset")).toHaveValue("ANY");
    expect(screen.queryByTestId("kb-date-from")).not.toBeInTheDocument();
  });
});
