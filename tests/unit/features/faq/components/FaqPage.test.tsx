import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FaqPage } from "../../../../../src/features/faq/components/FaqPage";
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
      count: 5,
      title: "Understanding what X is",
      question: "What is X?",
      recentCount: 1,
      trend: "FADING",
      topDocuments: [{ id: "d2", title: "X Doc" }],
    },
  ],
  rebuildQuestionCount: 15,
  rebuildQuestionLimit: 2000,
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

  it("renders the statistics header", () => {
    renderPage();
    expect(screen.getByText("Questions tracked")).toBeInTheDocument();
    expect(screen.getByText("Times asked")).toBeInTheDocument();
    expect(screen.getByText("Picking up")).toBeInTheDocument();
  });

  it("headlines each entry with its generated title", () => {
    renderPage();
    // The title is what makes the list scannable — a verbatim question would
    // mean reading a sentence per row.
    expect(screen.getByText("Deploying to production")).toBeInTheDocument();
    expect(screen.getByText("Understanding what X is")).toBeInTheDocument();
  });

  it("keeps the wording users actually ask it in under the title", () => {
    renderPage();
    expect(screen.getByText("How to deploy?")).toBeInTheDocument();
    expect(screen.getByText("What is X?")).toBeInTheDocument();
  });

  it("lists the entries flat, most asked first", () => {
    renderPage();
    const titles = screen
      .getAllByRole("button")
      .map((button) => button.textContent)
      .filter((text) => text?.includes("Deploying") ?? text?.includes("Understanding"));
    expect(titles[0]).toContain("Deploying to production");
  });

  it("shows which way each entry is moving", () => {
    renderPage();
    // The count answers "rising from what?" without the reader opening anything.
    expect(screen.getByText("Rising · 7")).toBeInTheDocument();
    expect(screen.getByText("Quiet · 1")).toBeInTheDocument();
  });

  it("says how many questions the rebuild would use", () => {
    renderPage();
    expect(screen.getByText("Rebuild uses 15 questions")).toBeInTheDocument();
  });

  it("warns when the rebuild would drop the older questions", () => {
    vi.mocked(useLiveFetch).mockReturnValueOnce({
      ...loaded,
      data: { ...mockOverview, rebuildQuestionCount: 2000 },
    });
    renderPage();
    // A rebuild replaces the FAQ, so anything past the cap leaves the counts
    // with it. That belongs before the click, not after.
    expect(screen.getByText("Rebuild uses the newest 2,000 questions")).toBeInTheDocument();
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
