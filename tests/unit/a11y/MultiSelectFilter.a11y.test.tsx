import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MultiSelectFilter } from "../../../src/components/ui/MultiSelectFilter.tsx";

const REPOS = Array.from({ length: 12 }, (_, i) => ({
  value: `org/repo-${i}`,
  label: `org/repo-${i}`,
  count: 12 - i,
}));

describe("MultiSelectFilter a11y", () => {
  it("has no violations with a searchable, folded section and a footnote open", async () => {
    const { baseElement } = render(
      <MultiSelectFilter<string>
        label="Filter sources"
        summary="All sources"
        activeCount={0}
        sections={[
          {
            id: "repositories",
            label: "Repositories",
            options: REPOS,
            searchable: true,
            visibleLimit: 10,
          },
        ]}
        selected={new Set<string>()}
        onToggle={vi.fn()}
        testId="kb-filter"
        footnote="Counts show what you would get if you added this option."
      />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(screen.getByTestId("kb-filter-section-repositories-search")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
