import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FaqPage } from "../../../../../src/features/faq/components/FaqPage";
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
      count: 5,
      question: "What is X?",
      category: "Concepts",
      recentCount: 1,
      trend: "FADING",
      topDocuments: [{ id: "d2", title: "X Doc" }],
    },
    {
      groupId: "g3",
      count: 2,
      question: "Where is the changelog?",
      topDocuments: [],
    },
  ],
  categories: [
    {
      name: "Deployment",
      groupCount: 1,
      questionCount: 10,
      recentQuestionCount: 7,
      trend: "RISING",
      lastAskedAt: "2026-08-13T09:00:00Z",
    },
    {
      name: "Concepts",
      groupCount: 1,
      questionCount: 5,
      recentQuestionCount: 1,
      trend: "FADING",
      lastAskedAt: "2026-07-20T09:00:00Z",
    },
  ],
};

vi.mock("../../../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/faqService", () => ({
  insightsService: { fetchFAQGroups: vi.fn(), refreshFAQGroups: vi.fn() },
}));

import { useLiveFetch } from "../../../../../src/hooks/useLiveFetch";

const loaded = {
  data: mockOverview,
  loading: false,
  revalidating: false,
  error: false,
  refresh: vi.fn(),
};

function renderPage() {
  return render(
    <MemoryRouter>
      <FaqPage />
    </MemoryRouter>,
  );
}

describe("FaqPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveFetch).mockReturnValue(loaded);
  });

  it("renders the page title and header", () => {
    renderPage();
    expect(screen.getByText("Recurring Questions")).toBeInTheDocument();
  });

  it("renders the statistics header with topic and question counts", () => {
    renderPage();
    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("Question groups")).toBeInTheDocument();
    expect(screen.getByText("Total questions")).toBeInTheDocument();
  });

  it("groups the questions under their topic instead of listing them flat", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Deployment" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Concepts" })).toBeInTheDocument();
    expect(screen.getByText("What is X?")).toBeInTheDocument();
  });

  it("shows the most asked question exactly once", () => {
    renderPage();
    // It already appears under its topic; a "most asked" hero on top of that
    // would put the same question on the page twice.
    expect(screen.getAllByText("How to deploy?")).toHaveLength(1);
  });

  it("keeps the backend's topic order, so a topic that is picking up sits on top", () => {
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Deployment", "Concepts", "Not yet categorised"]);
  });

  it("surfaces uncategorised questions rather than dropping them", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Not yet categorised" })).toBeInTheDocument();
    expect(screen.getByText("Where is the changelog?")).toBeInTheDocument();
  });

  it("shows which way each topic is moving", () => {
    renderPage();
    // The count answers "rising from what?" without the reader opening anything.
    expect(screen.getAllByText("Rising · 7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quiet · 1").length).toBeGreaterThan(0);
  });

  it("collapses a topic section when its header is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Concepts/ }));

    expect(screen.queryByText("What is X?")).not.toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: null, loading: true });
    const { container } = renderPage();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("explains that questions appear on their own when there are none", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: null, error: true });
    renderPage();
    expect(screen.getByText(/No recurring questions yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rebuild/i })).toBeInTheDocument();
  });

  it("shows the empty state when there are no groups", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({ ...loaded, data: { groups: [] } });
    renderPage();
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
