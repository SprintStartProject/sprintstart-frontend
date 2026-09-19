import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MultiSelectFilter } from "../../../../src/components/ui/MultiSelectFilter";

type Value = "GITHUB" | "JIRA" | "UPLOAD" | "PDF";

const SECTIONS = [
  {
    id: "sources",
    label: "Sources",
    options: [
      { value: "GITHUB" as Value, label: "GitHub", count: 6 },
      { value: "JIRA" as Value, label: "Jira", count: 2 },
    ],
  },
  {
    id: "formats",
    label: "File format",
    options: [{ value: "PDF" as Value, label: "PDFs", count: 3 }],
  },
];

function renderFilter(overrides: Partial<Parameters<typeof MultiSelectFilter<Value>>[0]> = {}) {
  const onToggle = vi.fn();
  const result = render(
    <MultiSelectFilter<Value>
      label="Filter artifacts"
      summary="All sources · All types"
      activeCount={0}
      sections={SECTIONS}
      selected={new Set<Value>()}
      onToggle={onToggle}
      testId="kb-filter"
      {...overrides}
    />,
  );
  return { onToggle, ...result };
}

describe("MultiSelectFilter", () => {
  it("keeps the menu closed until the trigger is pressed", () => {
    renderFilter();

    const trigger = screen.getByTestId("kb-filter-trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("kb-filter-menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("kb-filter-menu")).toBeInTheDocument();
  });

  it("offers a real checkbox per option and reports toggles", () => {
    const { onToggle } = renderFilter();

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    const jira = screen.getByRole("checkbox", { name: /Jira/ });
    expect(jira).not.toBeChecked();

    fireEvent.click(jira);
    expect(onToggle).toHaveBeenCalledWith("JIRA");
  });

  it("stays open while options are ticked, and closes on Escape", async () => {
    renderFilter({ selected: new Set<Value>(["GITHUB"]) });

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    const github = screen.getByRole("checkbox", { name: /GitHub/ });
    expect(github).toBeChecked();

    fireEvent.click(github);
    expect(screen.getByTestId("kb-filter-menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("kb-filter-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("kb-filter-trigger")).toHaveFocus();
  });

  it("folds a section away without losing the others", () => {
    renderFilter();

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    const header = screen.getByTestId("kb-filter-section-sources");
    expect(header).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: /GitHub/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /PDFs/ })).toBeInTheDocument();
  });

  it("shows the count badge only when something is selected", () => {
    const { unmount } = renderFilter();
    expect(screen.getByTestId("kb-filter-trigger")).not.toHaveTextContent("2");
    unmount();

    renderFilter({ activeCount: 2, summary: "GitHub · Issues" });
    expect(screen.getByTestId("kb-filter-trigger")).toHaveTextContent("GitHub · Issues");
    expect(screen.getByTestId("kb-filter-trigger")).toHaveTextContent("2");
  });

  it("has no 'All' option to confuse a reset with a filter", () => {
    renderFilter();

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    expect(screen.queryByRole("checkbox", { name: /^all/i })).not.toBeInTheDocument();
  });

  it("takes its height from `size`, so a toolbar can rank the controls", () => {
    const { unmount } = renderFilter();
    expect(screen.getByTestId("kb-filter-trigger")).toHaveClass("h-9");
    unmount();

    renderFilter({ size: "md" });
    expect(screen.getByTestId("kb-filter-trigger")).toHaveClass("h-11");
  });
  it("says so instead of opening an empty panel when there is nothing to filter", () => {
    renderFilter({ sections: [] });

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    expect(screen.getByTestId("kb-filter-menu")).toHaveTextContent("Nothing to filter yet");
  });

  it("renders options directly without collapsible accordion headers when collapsible is false", () => {
    renderFilter({ collapsible: false });

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    // No accordion buttons should be rendered
    expect(screen.queryByTestId("kb-filter-section-sources")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kb-filter-section-formats")).not.toBeInTheDocument();

    // Checkboxes are immediately available
    expect(screen.getByRole("checkbox", { name: /GitHub/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /PDFs/ })).toBeInTheDocument();
  });
});
