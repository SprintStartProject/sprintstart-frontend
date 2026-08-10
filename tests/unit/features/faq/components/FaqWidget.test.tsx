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
      topDocuments: [{ id: "d1", title: "Deploy Guide" }],
    },
    {
      groupId: "g2",
      count: 8,
      question: "How to configure?",
      topDocuments: [{ id: "d2", title: "Config Doc" }],
    },
    {
      groupId: "g3",
      count: 5,
      question: "What is X?",
      topDocuments: [{ id: "d3", title: "X Doc" }],
    },
  ],
};

vi.mock("../../../../../src/hooks/useFetch", () => ({
  useFetch: vi.fn(),
}));

vi.mock("../../../../../src/services/faqService", () => ({
  insightsService: { fetchFAQGroups: vi.fn() },
}));

import { useFetch } from "../../../../../src/hooks/useFetch";

vi.mocked(useFetch).mockReturnValue({ data: mockOverview, loading: false, error: false });

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
  });

  it("renders the hero card with the most asked question", () => {
    renderWidget();
    expect(screen.getByText("How to deploy?")).toBeInTheDocument();
    expect(screen.getByText("Most asked")).toBeInTheDocument();
  });

  it("renders the grid of remaining groups", () => {
    renderWidget();
    expect(screen.getByText("How to configure?")).toBeInTheDocument();
    expect(screen.getByText("What is X?")).toBeInTheDocument();
  });

  it('shows the header with "Recurring questions"', () => {
    renderWidget();
    expect(screen.getByText("Recurring questions")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    vi.mocked(useFetch).mockReturnValueOnce({ data: null, loading: true, error: false });
    const { container } = renderWidget();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows the empty/refresh state when there is an error", () => {
    vi.mocked(useFetch).mockReturnValueOnce({ data: null, loading: false, error: true });
    renderWidget();
    expect(
      screen.getByText("No FAQ groups yet. Trigger a refresh to generate them."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("shows the empty/refresh state when overview has no groups", () => {
    vi.mocked(useFetch).mockReturnValueOnce({ data: { groups: [] }, loading: false, error: false });
    renderWidget();
    expect(
      screen.getByText("No FAQ groups yet. Trigger a refresh to generate them."),
    ).toBeInTheDocument();
  });
});
