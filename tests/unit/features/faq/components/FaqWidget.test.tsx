import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FaqWidget } from "../../../../../src/features/faq/components/FaqWidget";
import type { FAQOverview } from "../../../../../src/features/faq/types";
import { MemoryRouter } from "react-router-dom";

const mockOverview: FAQOverview = {
  groups: [
    {
      groupId: "g1",
      count: 10,
      title: "Deploying to production",
      question: "How to deploy?",
      recentCount: 7,
      trend: "RISING",
      topDocuments: [{ id: "d1", title: "Deploy Guide" }],
    },
    {
      groupId: "g2",
      count: 8,
      title: "Configuring the service",
      question: "How to configure?",
      topDocuments: [{ id: "d2", title: "Config Doc" }],
    },
    {
      groupId: "g3",
      count: 5,
      title: "Understanding what X is",
      question: "What is X?",
      topDocuments: [{ id: "d3", title: "X Doc" }],
    },
  ],
};

vi.mock("../../../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/faqService", () => ({
  insightsService: { fetchFAQGroups: vi.fn() },
}));

import { useLiveFetch } from "../../../../../src/hooks/useLiveFetch";

const loaded = {
  data: mockOverview,
  loading: false,
  revalidating: false,
  error: false,
  refresh: vi.fn(),
};

function renderWidget() {
  return render(
    <MemoryRouter>
      <FaqWidget />
    </MemoryRouter>,
  );
}

describe("FaqWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveFetch).mockReturnValue(loaded);
  });

  it("renders the hero card with the most asked entry", () => {
    renderWidget();
    expect(screen.getByText("Deploying to production")).toBeInTheDocument();
    expect(screen.getByText("How to deploy?")).toBeInTheDocument();
    expect(screen.getByText("Most asked")).toBeInTheDocument();
  });

  it("lists the remaining entries by title", () => {
    renderWidget();
    // Titles rather than verbatim questions: the tiles are small, and a
    // sentence per tile is not something a PM can scan.
    expect(screen.getByText("Configuring the service")).toBeInTheDocument();
    expect(screen.getByText("Understanding what X is")).toBeInTheDocument();
  });

  it('shows the header with "Recurring questions"', () => {
    renderWidget();
    expect(screen.getByText("Recurring questions")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: null, loading: true });
    const { container } = renderWidget();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  // On a dashboard the two states are one glance apart, so a failed load must
  // not pose as "nobody has asked anything yet".
  it("reports a failed load as an error rather than an empty FAQ", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: null, error: true });
    renderWidget();
    expect(screen.getByText(/could not load the recurring questions/i)).toBeInTheDocument();
    expect(screen.queryByText(/No recurring questions yet/)).not.toBeInTheDocument();
  });

  it("shows the empty state when overview has no groups", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: { groups: [] } });
    renderWidget();
    expect(screen.getByText(/No recurring questions yet/)).toBeInTheDocument();
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
