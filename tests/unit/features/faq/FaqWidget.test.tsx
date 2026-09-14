import { render, screen, waitFor } from "@testing-library/react";
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
    // `waitFor` re-queries the DOM fresh on every poll rather than `findBy*`'s single
    // handle: `selectedProjectId` moves through several values as the real (unmocked)
    // AuthProvider/ProjectProvider chain settles, and each change re-renders this content
    // under a new query key — a `findBy*` reference grabbed mid-chain can go stale (removed
    // from the document) between resolving and the assertion actually running against it.
    await waitFor(() => {
      expect(screen.getByText(/No recurring questions yet/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open faq page/i })).toBeInTheDocument();
    });
  });
});
