import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { OffboardingPage } from "../../../src/pages/OffboardingPage";
import type { RiskMap } from "../../../src/services/offboardingTypes";
import { server } from "../setup/vitest.setup";

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "proj1" }),
}));

const map: RiskMap = {
  asOf: "2026-11-20T12:00:00Z",
  settings: {
    halfLifeDays: 152,
    inactiveAfterDays: 365,
    authorThreshold: 0.75,
    knowledgeWeight: 0.7,
    activityWeight: 0.3,
    name: "default",
    sourceWeights: { commits: 1 },
  },
  departing: ["ada"],
  unknownDeparting: [],
  summary: { files: 6, orphaned: 1, hoarded: 0, alreadyOrphaned: 0, listed: 1 },
  files: [
    {
      repository: "github:acme/app",
      path: "src/Engine.kt",
      level: "ORPHANED",
      score: 0.9,
      departingShare: 1,
      sourceBreakdown: { commits: 1 },
      recentActivity: 0.5,
      fragmentation: 0,
      remainingKnowers: [],
      lastChangedAt: "2026-11-01T00:00:00Z",
    },
  ],
};

function renderPage() {
  render(
    <MemoryRouter>
      <OffboardingPage />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

async function rankFor(user: ReturnType<typeof userEvent.setup>, person: string) {
  await user.type(screen.getByLabelText("Who is leaving?"), `${person}{Enter}`);
  await user.click(screen.getByRole("button", { name: "Rank files" }));
}

describe("OffboardingPage", () => {
  it("asks for nothing until somebody is named", () => {
    let asked = false;
    server.use(
      http.get("/api/v1/projects/proj1/offboarding/risk", () => {
        asked = true;
        return HttpResponse.json(map);
      }),
    );

    renderPage();

    expect(screen.getByRole("heading", { name: "Offboarding" })).toBeInTheDocument();
    expect(asked).toBe(false);
    expect(screen.queryByText("files lose their last author")).not.toBeInTheDocument();
  });

  it("ranks the files that lose the person who is named", async () => {
    let leaving: string[] = [];
    server.use(
      http.get("/api/v1/projects/proj1/offboarding/risk", ({ request }) => {
        leaving = new URL(request.url).searchParams.getAll("leaving");
        return HttpResponse.json(map);
      }),
    );
    const user = renderPage();

    await rankFor(user, "ada");

    expect(await screen.findByText("files lose their last author")).toBeInTheDocument();
    expect(leaving).toEqual(["ada"]);
  });

  it("says so when the ranking cannot be computed", async () => {
    server.use(
      http.get("/api/v1/projects/proj1/offboarding/risk", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const user = renderPage();

    await rankFor(user, "ada");

    await waitFor(() =>
      expect(screen.getByText("The ranking could not be computed")).toBeInTheDocument(),
    );
    expect(screen.queryByText("files lose their last author")).not.toBeInTheDocument();
  });
});
