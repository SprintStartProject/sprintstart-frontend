import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SegmentedTabs,
  type SegmentedTabOption,
} from "../../../../src/components/ui/SegmentedTabs";

describe("SegmentedTabs", () => {
  const options: SegmentedTabOption<string>[] = [
    { value: "all", label: "All", count: 12, testId: "tab-all" },
    { value: "github", label: "GitHub", count: 5, testId: "tab-github" },
    { value: "jira", label: "Jira", count: 2, testId: "tab-jira" },
  ];

  it("renders tab options with accessible pressed states and counts", () => {
    render(
      <SegmentedTabs
        value="github"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs"
        ariaLabel="Filter items"
      />,
    );

    const allBtn = screen.getByTestId("tab-all");
    const ghBtn = screen.getByTestId("tab-github");
    const jiraBtn = screen.getByTestId("tab-jira");

    expect(allBtn).toHaveAttribute("aria-pressed", "false");
    expect(ghBtn).toHaveAttribute("aria-pressed", "true");
    expect(jiraBtn).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onChange when an inactive tab is clicked", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={onChange}
        layoutId="test-tabs"
        ariaLabel="Filter items"
      />,
    );

    await userEvent.click(screen.getByTestId("tab-jira"));
    expect(onChange).toHaveBeenCalledWith("jira");
  });

  it("renders compact tabs with size='sm'", () => {
    render(
      <SegmentedTabs
        value="jira"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-sm"
        ariaLabel="Filter items compact"
        size="sm"
      />,
    );

    const jiraBtn = screen.getByTestId("tab-jira");
    expect(jiraBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("bypasses scroll-into-view adjustments when wrap is enabled", () => {
    const scrollToMock = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollToMock;

    try {
      const { rerender } = render(
        <SegmentedTabs
          value="all"
          options={options}
          onChange={vi.fn()}
          layoutId="test-tabs-wrap"
          ariaLabel="Filter items"
          wrap
        />,
      );

      rerender(
        <SegmentedTabs
          value="jira"
          options={options}
          onChange={vi.fn()}
          layoutId="test-tabs-wrap"
          ariaLabel="Filter items"
          wrap
        />,
      );

      expect(scrollToMock).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollTo = originalScrollTo;
    }
  });

  it("renders all options as accessible toggle buttons when wrapping", () => {
    render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-wrap-buttons"
        ariaLabel="Filter items"
        wrap
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "false");
  });
});
