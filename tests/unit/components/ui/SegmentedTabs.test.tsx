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

  it("applies flex-wrap classes when wrap is enabled", () => {
    const { container } = render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs"
        ariaLabel="Filter items"
        wrap
      />,
    );

    const group = container.querySelector('[role="group"]');
    expect(group?.className).toContain("flex-wrap");
    expect(group?.className).not.toContain("overflow-x-auto");
  });

  it("applies overflow-x-auto when wrap is false", () => {
    const { container } = render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs"
        ariaLabel="Filter items"
        wrap={false}
      />,
    );

    const group = container.querySelector('[role="group"]');
    expect(group?.className).toContain("overflow-x-auto");
    expect(group?.className).not.toContain("flex-wrap");
  });
});
