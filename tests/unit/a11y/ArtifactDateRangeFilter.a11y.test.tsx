import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { ArtifactDateRangeFilter } from "../../../src/features/knowledge-base/components/ArtifactDateRangeFilter.tsx";

describe("ArtifactDateRangeFilter a11y", () => {
  it("has no violations with a custom range open and a reversed-range error shown", async () => {
    const { container } = render(
      <ArtifactDateRangeFilter
        range={{ from: "2026-09-10", to: null }}
        onRangeChange={vi.fn()}
        now={new Date("2026-09-24T10:00:00Z")}
      />,
    );
    fireEvent.change(screen.getByLabelText("Added to"), { target: { value: "2026-09-01" } });
    expect(screen.getByTestId("kb-date-error")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
