import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgeGapsPage } from "../../../../../src/features/knowledge-gaps/components/KnowledgeGapsPage";
import type { KnowledgeGapOverview } from "../../../../../src/features/knowledge-gaps/types";
import { MemoryRouter } from "react-router-dom";

const mockOverview: KnowledgeGapOverview = {
  gaps: [
    {
      id: "gap1",
      component: "Auth Service",
      missingTypes: ["README"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity: "high",
    },
    {
      id: "gap2",
      component: "API Gateway",
      missingTypes: ["API Docs"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity: "medium",
    },
    {
      id: "gap3",
      component: "Database",
      missingTypes: ["Schema"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity: "low",
    },
  ],
};

vi.mock("../../../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { fetchKnowledgeGaps: vi.fn() },
}));

import { useLiveFetch } from "../../../../../src/hooks/useLiveFetch";

vi.mocked(useLiveFetch).mockReturnValue({
  data: mockOverview,
  loading: false,
  revalidating: false,
  error: false,
  refresh: () => {},
});

function renderPage() {
  return render(
    <MemoryRouter>
      <KnowledgeGapsPage />
    </MemoryRouter>,
  );
}

describe("KnowledgeGapsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveFetch).mockReturnValue({
      data: mockOverview,
      loading: false,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
  });

  it("renders the page title and gap cards", () => {
    renderPage();
    expect(screen.getByText("Knowledge Gaps")).toBeInTheDocument();
    expect(screen.getByText("Auth Service")).toBeInTheDocument();
    expect(screen.getByText("API Gateway")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  // A component in good shape is a finding of its own — leaving it out made it
  // indistinguishable from one that was never ingested.
  it("lists a component with no gaps and says what it has instead", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: {
        gaps: [
          {
            id: "gap4",
            component: "Docs Wiki",
            missingTypes: [],
            presentTypes: ["readme", "setup"],
            lastIngested: new Date().toISOString(),
            refreshedAt: new Date().toISOString(),
            owners: [],
            severity: "covered",
          },
        ],
      },
      loading: false,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
    renderPage();

    // Scoped to the card: "Covered" is also the label of its filter toggle.
    const card = within(screen.getByRole("button", { name: /Docs Wiki/ }));
    expect(card.getByText("Covered")).toBeInTheDocument();
    // "Missing documentation (0)" over an empty row would say nothing at all.
    expect(card.getByText(/all expected documentation present \(2\)/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: null,
      loading: true,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
    const { container } = renderPage();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  // The four no-gaps-to-show outcomes below used to render one shared message.
  // "A scan found nothing" and "no scan has run" are opposite answers, and
  // conflating them made a clean result read as a scan that never happened.
  it("reports a failed load as an error rather than an empty result", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: null,
      loading: false,
      revalidating: false,
      error: true,
      refresh: () => {},
    });
    renderPage();
    expect(screen.getByText(/could not load knowledge gaps/i)).toBeInTheDocument();
    expect(screen.queryByText(/no scan has run yet/i)).not.toBeInTheDocument();
  });

  it("says no scan has run when there is no result yet", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: { gaps: [] },
      loading: false,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
    renderPage();
    expect(screen.getByText(/no scan has run yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rescan/i })).toBeInTheDocument();
  });

  it("says a completed scan found nothing to report on", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: { gaps: [], refreshedAt: new Date().toISOString() },
      loading: false,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
    renderPage();
    expect(screen.getByText(/found no ingested repositories/i)).toBeInTheDocument();
    expect(screen.getByText(/last analyzed/i)).toBeInTheDocument();
    expect(screen.queryByText(/no scan has run yet/i)).not.toBeInTheDocument();
  });

  it("says a rescan is running instead of reporting an empty result", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      data: { gaps: [], refreshing: true, refreshedAt: new Date().toISOString() },
      loading: false,
      revalidating: false,
      error: false,
      refresh: () => {},
    });
    renderPage();
    expect(screen.getByText(/scanning the newly ingested documentation/i)).toBeInTheDocument();
    expect(screen.queryByText(/found no ingested repositories/i)).not.toBeInTheDocument();
  });

  // The controls are no longer behind a disclosure -- they are always on the
  // page, so there is nothing to expand first.
  it("shows the severity toggles and the sort order without expanding anything", () => {
    renderPage();

    const severityGroup = within(screen.getByRole("group", { name: "Filter gaps by severity" }));

    expect(severityGroup.getByRole("button", { name: "High" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Sort knowledge gaps" })).toHaveTextContent(
      "Severity",
    );
  });

  it("filters gaps by severity when a filter is toggled off", async () => {
    const user = userEvent.setup();
    renderPage();

    const highFilter = within(
      screen.getByRole("group", { name: "Filter gaps by severity" }),
    ).getByRole("button", { name: "High" });
    await user.click(highFilter);

    expect(highFilter).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Auth Service")).not.toBeInTheDocument();
    expect(screen.getByText("API Gateway")).toBeInTheDocument();
  });

  it("changes the sort order when a sort option is chosen", async () => {
    const user = userEvent.setup();
    renderPage();

    const sorter = screen.getByRole("combobox", { name: "Sort knowledge gaps" });
    await user.click(sorter);
    await user.click(screen.getByRole("option", { name: "Component name" }));

    expect(sorter).toHaveTextContent("Component name");
  });

  it("shows the reset button when filters are not default", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole("group", { name: "Filter gaps by severity" })).getByRole("button", {
        name: "High",
      }),
    );

    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
vi.mock("../../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});
