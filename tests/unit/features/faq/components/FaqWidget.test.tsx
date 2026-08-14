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
      question: "How to deploy?",
      category: "Deployment",
      recentCount: 7,
      trend: "RISING",
      topDocuments: [{ id: "d1", title: "Deploy Guide" }],
    },
    {
      groupId: "g2",
      count: 8,
      question: "How to configure?",
      category: "Deployment",
      topDocuments: [{ id: "d2", title: "Config Doc" }],
    },
    {
      groupId: "g3",
      count: 5,
      question: "What is X?",
      category: "Concepts",
      topDocuments: [{ id: "d3", title: "X Doc" }],
    },
  ],
  categories: [
    {
      name: "Deployment",
      groupCount: 2,
      questionCount: 18,
      recentQuestionCount: 7,
      trend: "RISING",
      lastAskedAt: "2026-08-13T09:00:00Z",
    },
    {
      name: "Concepts",
      groupCount: 1,
      questionCount: 5,
      recentQuestionCount: 0,
      trend: "FADING",
      lastAskedAt: "2026-07-01T09:00:00Z",
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

  it("renders the hero card with the most asked question", () => {
    renderWidget();
    expect(screen.getByText("How to deploy?")).toBeInTheDocument();
    expect(screen.getByText("Most asked")).toBeInTheDocument();
  });

  it("summarises the topics rather than listing individual questions", () => {
    renderWidget();
    // The topic is the level a PM scans by once the question set grows; a
    // second flat list of questions would be the problem, not the summary.
    expect(screen.getByText("Concepts")).toBeInTheDocument();
    expect(screen.getByText("2 groups")).toBeInTheDocument();
    expect(screen.queryByText("How to configure?")).not.toBeInTheDocument();
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

  it("explains that questions appear on their own when there is an error", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: null, error: true });
    renderWidget();
    expect(screen.getByText(/No recurring questions yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open faq page/i })).toBeInTheDocument();
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
