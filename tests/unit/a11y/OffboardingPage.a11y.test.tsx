import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { OffboardingPage } from "../../../src/pages/OffboardingPage";
import { server } from "../setup/vitest.setup";

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "proj1" }),
}));

const map = {
  asOf: "2026-11-20T12:00:00Z",
  settings: {
    halfLifeDays: 152,
    inactiveAfterDays: 365,
    authorThreshold: 0.75,
    knowledgeWeight: 0.7,
    activityWeight: 0.3,
    name: "default",
    sourceWeights: { commits: 1, reviews: 0.5 },
  },
  departing: ["ada"],
  unknownDeparting: ["typo@x.org"],
  summary: { files: 6, orphaned: 1, hoarded: 1, alreadyOrphaned: 0, listed: 2 },
  files: [
    {
      repository: "github:acme/app",
      path: "src/Engine.kt",
      level: "ORPHANED",
      score: 0.9,
      departingShare: 1,
      sourceBreakdown: { commits: 1, reviews: 0.5 },
      recentActivity: 0.5,
      fragmentation: 0,
      remainingKnowers: [],
      lastChangedAt: "2026-11-01T00:00:00Z",
    },
    {
      repository: "github:acme/app",
      path: "src/Util.kt",
      level: "HOARDED",
      score: 0.4,
      departingShare: 0.5,
      sourceBreakdown: { commits: 0.5 },
      recentActivity: 0.2,
      fragmentation: 0.5,
      remainingKnowers: ["ben"],
      lastChangedAt: "2026-10-01T00:00:00Z",
    },
  ],
};

describe("OffboardingPage accessibility", () => {
  it("has no violations before a departure is named", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <OffboardingPage />
      </MemoryRouter>,
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no violations with a ranking, a warning and a validation message", async () => {
    server.use(http.get("/api/v1/projects/proj1/offboarding/risk", () => HttpResponse.json(map)));
    const user = userEvent.setup();
    const { baseElement } = render(
      <MemoryRouter>
        <OffboardingPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(await screen.findByText("files lose their last author")).toBeInTheDocument();

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
