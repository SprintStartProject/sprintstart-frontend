import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataIngestionSectionFilter } from "../../../../../src/features/data-ingestion/components/DataIngestionSectionFilter";

function filter() {
  return within(screen.getByRole("group", { name: /filter sections/i }));
}

describe("DataIngestionSectionFilter", () => {
  it("renders the dashboard sections with counts", () => {
    render(
      <DataIngestionSectionFilter
        active="overview"
        onChange={vi.fn()}
        sourceCount={4}
        runCount={3}
      />,
    );

    expect(filter().getByRole("button", { name: /overview/i })).toBeInTheDocument();
    expect(filter().getByRole("button", { name: /sources/i })).toHaveTextContent("4");
    expect(filter().getByRole("button", { name: /runs/i })).toHaveTextContent("3");
  });

  it("no longer offers a separate All section", () => {
    render(
      <DataIngestionSectionFilter
        active="overview"
        onChange={vi.fn()}
        sourceCount={4}
        runCount={3}
      />,
    );

    expect(filter().queryByRole("button", { name: /^all$/i })).not.toBeInTheDocument();
    expect(filter().getAllByRole("button")).toHaveLength(3);
  });

  it("does not expose connectors as a dashboard section", () => {
    render(
      <DataIngestionSectionFilter
        active="overview"
        onChange={vi.fn()}
        sourceCount={4}
        runCount={3}
      />,
    );

    expect(filter().queryByRole("button", { name: /connectors/i })).not.toBeInTheDocument();
  });

  it("marks the active section as pressed and highlighted", () => {
    render(
      <DataIngestionSectionFilter active="runs" onChange={vi.fn()} sourceCount={4} runCount={3} />,
    );

    const runsButton = filter().getByRole("button", { name: /runs/i });
    expect(runsButton).toHaveAttribute("aria-pressed", "true");
    // The brand fill is a separate element that slides between tabs, so it
    // lives inside the active button rather than on it.
    expect(runsButton.querySelector(".bg-app-brand")).not.toBeNull();
  });

  it("calls onChange with the clicked section", async () => {
    const onChange = vi.fn();
    render(
      <DataIngestionSectionFilter
        active="sources"
        onChange={onChange}
        sourceCount={4}
        runCount={3}
      />,
    );

    await userEvent.click(filter().getByRole("button", { name: /overview/i }));
    expect(onChange).toHaveBeenCalledWith("overview");
  });
});
