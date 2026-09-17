import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtifactFilters } from "../../../../../src/features/knowledge-base/components/ArtifactFilters";

describe("ArtifactFilters", () => {
  it("renders search input, connector tabs, and underfilters", () => {
    const onSearchChange = vi.fn();
    const onConnectorChange = vi.fn();
    const onSubfilterChange = vi.fn();

    render(
      <ArtifactFilters
        searchQuery="test"
        onSearchChange={onSearchChange}
        activeConnector="GITHUB"
        onConnectorChange={onConnectorChange}
        availableConnectors={["ALL", "GITHUB", "UPLOAD"]}
        connectorCounts={{ ALL: 10, GITHUB: 6, UPLOAD: 4, JIRA: 0, CONFLUENCE: 0 }}
        activeSubfilter="PR"
        onSubfilterChange={onSubfilterChange}
        subfilterOptions={[
          { id: "ALL", label: "All GitHub", count: 6 },
          { id: "PR", label: "Pull Requests", count: 2 },
          { id: "ISSUES", label: "Issues", count: 4 },
        ]}
      />,
    );

    // Search input
    const searchInput = screen.getByTestId("kb-search-input");
    expect(searchInput).toHaveValue("test");

    // Connector tabs
    expect(screen.getByTestId("kb-connector-all")).toBeInTheDocument();
    expect(screen.getByTestId("kb-connector-github")).toBeInTheDocument();
    expect(screen.getByTestId("kb-connector-upload")).toBeInTheDocument();

    // Underfilters
    expect(screen.getByTestId("kb-subfilter-pr")).toBeInTheDocument();
    expect(screen.getByTestId("kb-subfilter-issues")).toBeInTheDocument();

    // Click another connector
    fireEvent.click(screen.getByTestId("kb-connector-upload"));
    expect(onConnectorChange).toHaveBeenCalledWith("UPLOAD");

    // Click subfilter
    fireEvent.click(screen.getByTestId("kb-subfilter-issues"));
    expect(onSubfilterChange).toHaveBeenCalledWith("ISSUES");
  });

  it("triggers refresh callback when refresh button clicked", () => {
    const onRefresh = vi.fn();
    render(
      <ArtifactFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        activeConnector="ALL"
        availableConnectors={["ALL"]}
        onRefresh={onRefresh}
      />,
    );

    const refreshBtn = screen.getByTestId("kb-refresh");
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
