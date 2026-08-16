import { render, screen, waitFor } from "@testing-library/react";
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
    {
      groupId: "g3",
      count: 1,
      title: "Asked once only",
      question: "Where is the changelog?",
      recentCount: 1,
      trend: "RISING",
      topDocuments: [],
    },
  ],
  questionCount: 15,
  rebuildQuestionLimit: 2000,
};

vi.mock("../../../../../src/hooks/useLiveFetch", () => ({
  useLiveFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/faqService", () => ({
  insightsService: {
    fetchFAQGroups: vi.fn(),
    refreshFAQGroups: vi.fn(),
    fetchRebuildPreview: vi.fn(),
  },
}));

import { useLiveFetch } from "../../../../../src/hooks/useLiveFetch";
import { insightsService } from "../../../../../src/services/faqService";

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

/**
 * Picks a rebuild scope.
 *
 * The picker is the app's combobox rather than a native select, so it is opened
 * and then clicked rather than driven with `selectOptions`. Its menu is
 * portalled out of the modal, which `screen` reaches because it queries the
 * whole document.
 */
async function chooseScope(user: ReturnType<typeof userEvent.setup>, optionLabel: string) {
  await user.click(await screen.findByRole("combobox", { name: "Questions to regroup" }));
  await user.click(await screen.findByRole("option", { name: optionLabel }));
}

describe("FaqPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveFetch).mockReturnValue(loaded);
    vi.mocked(insightsService.fetchRebuildPreview).mockResolvedValue({
      totalQuestionCount: 15,
      rebuildQuestionLimit: 2000,
      windows: [
        { sinceDays: 7, questionCount: 5 },
        { sinceDays: 30, questionCount: 11 },
        { sinceDays: 90, questionCount: 15 },
      ],
    });
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

  it("asks before rebuilding instead of doing it on the click", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));

    // A rebuild replaces the entries, rewrites the titles and breaks entry
    // links — none of it undoable by pressing the button again.
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/replaces the current entries/)).toBeInTheDocument();
    expect(insightsService.refreshFAQGroups).not.toHaveBeenCalled();
  });

  it("puts the selected scope's question count on the confirm button", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));

    // In the label rather than beside it, so the number and the action that
    // consumes it cannot drift apart on screen.
    expect(await screen.findByRole("button", { name: "Rebuild 15 questions" })).toBeInTheDocument();

    await chooseScope(user, "Asked in the last 30 days");
    expect(await screen.findByRole("button", { name: "Rebuild 11 questions" })).toBeInTheDocument();
  });

  it("rebuilds only over the chosen window", async () => {
    const user = userEvent.setup();
    vi.mocked(insightsService.refreshFAQGroups).mockResolvedValue({ groupCount: 1 });
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));
    await chooseScope(user, "Asked in the last 30 days");
    await user.click(screen.getByRole("button", { name: /^Rebuild \d/ }));

    expect(insightsService.refreshFAQGroups).toHaveBeenCalledWith("proj1", { sinceDays: 30 });
  });

  it("warns that a narrowed scope drops the rest", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));
    await chooseScope(user, "Asked in the last 30 days");

    // A rebuild replaces the FAQ, so anything outside the window leaves the
    // counts with it. That belongs before the click, not after.
    expect(screen.getByText(/dropped from the FAQ/)).toBeInTheDocument();
  });

  it("rebuilds over everything by default", async () => {
    const user = userEvent.setup();
    vi.mocked(insightsService.refreshFAQGroups).mockResolvedValue({ groupCount: 2 });
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));
    await user.click(await screen.findByRole("button", { name: /^Rebuild \d/ }));

    expect(insightsService.refreshFAQGroups).toHaveBeenCalledWith("proj1", {});
  });

  it("closes the dialog immediately and reports progress on the button", async () => {
    const user = userEvent.setup();
    let finish: (value: { groupCount: number }) => void = () => {};
    vi.mocked(insightsService.refreshFAQGroups).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderPage();

    await user.click(screen.getByRole("button", { name: /rebuild grouping/i }));
    await user.click(await screen.findByRole("button", { name: /^Rebuild \d/ }));

    // A rebuild takes as long as an AI call and there is nothing to watch;
    // pinning the PM to a spinner would buy no information.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Rebuilding/ })).toBeInTheDocument();

    finish({ groupCount: 2 });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Rebuild grouping/ })).toBeInTheDocument(),
    );
  });

  it("hides one-off questions when asked to", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /Asked more than once/ }));

    // A question asked once is not yet recurring — it is noise in a panel whose
    // whole subject is repetition.
    expect(screen.getByText("Deploying to production")).toBeInTheDocument();
    expect(screen.queryByText("Asked once only")).not.toBeInTheDocument();
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
