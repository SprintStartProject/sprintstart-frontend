import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../../../src/context/AuthProvider";
import { ProjectProvider } from "../../../../src/features/projects/ProjectProvider";
import { FaqWidget } from "../../../../src/features/faq/components/FaqWidget";

vi.mock("../../../../src/services/faqService", () => ({
  insightsService: {
    fetchFAQGroups: vi.fn().mockResolvedValue({ groups: [] }),
    refreshFAQGroups: vi.fn(),
  },
}));

describe("FaqWidget", () => {
  it("shows empty state when no groups exist", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProjectProvider>
            <FaqWidget />
          </ProjectProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/No FAQ groups yet/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });
});
