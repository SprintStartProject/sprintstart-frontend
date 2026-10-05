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

  it("wraps below lg only when the caller asks for it", () => {
    const { container, rerender } = render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-wrapbelow"
        ariaLabel="Filter items"
        wrapBelow="lg"
      />,
    );

    expect(container.firstElementChild?.classList.contains("max-lg:flex-wrap")).toBe(true);

    rerender(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-wrapbelow"
        ariaLabel="Filter items"
      />,
    );

    expect(container.firstElementChild?.classList.contains("max-lg:flex-wrap")).toBe(false);
  });

  it("grows the phone padding in both sizes", () => {
    const { unmount } = render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-growth-compact"
        ariaLabel="Filter items compact"
        size="sm"
      />,
    );

    expect(screen.getByTestId("tab-all").className).toContain("max-sm:py-3");
    unmount();

    render(
      <SegmentedTabs
        value="all"
        options={options}
        onChange={vi.fn()}
        layoutId="test-tabs-growth"
        ariaLabel="Filter items"
      />,
    );

    expect(screen.getByTestId("tab-all").className).toContain("max-sm:py-3");
  });

  describe("views inside an option", () => {
    const nested: SegmentedTabOption<string>[] = [
      { value: "overview", label: "Overview" },
      {
        value: "team",
        label: "Team",
        count: 9,
        subOptions: [
          { value: "members", label: "Members", count: 7 },
          { value: "roles", label: "Roles", count: 3 },
        ],
        subValue: "roles",
        subAriaLabel: "Team views",
      },
    ];

    it("grows them out of the selected option, and hides its own count meanwhile", () => {
      render(
        <SegmentedTabs
          value="team"
          options={nested}
          onChange={vi.fn()}
          layoutId="nested"
          ariaLabel="Sections"
        />,
      );

      const views = screen.getByRole("group", { name: "Team views" });
      expect(views).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Roles/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /Members/ })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByRole("button", { name: /^Team/ })).not.toHaveTextContent("9");
    });

    it("keeps them folded away while another option is selected", () => {
      render(
        <SegmentedTabs
          value="overview"
          options={nested}
          onChange={vi.fn()}
          layoutId="nested"
          ariaLabel="Sections"
        />,
      );

      expect(screen.queryByRole("group", { name: "Team views" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Team/ })).toHaveTextContent("9");
    });

    it("reports a chosen view through its own callback", async () => {
      const onChange = vi.fn();
      const onSubChange = vi.fn();
      const user = userEvent.setup();
      render(
        <SegmentedTabs
          value="team"
          options={nested.map((option) =>
            option.subOptions ? { ...option, onSubChange } : option,
          )}
          onChange={onChange}
          layoutId="nested"
          ariaLabel="Sections"
        />,
      );

      await user.click(screen.getByRole("button", { name: /Members/ }));
      expect(onSubChange).toHaveBeenCalledWith("members");
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
