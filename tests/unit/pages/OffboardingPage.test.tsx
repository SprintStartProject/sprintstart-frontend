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

const noMembers = http.get("/api/v1/projects/proj1/offboarding/identities/members", () =>
  HttpResponse.json({ matched: 0, total: 0, members: [] }),
);

function renderPage() {
  server.use(noMembers);
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
    expect(screen.queryByText("Files at risk")).not.toBeInTheDocument();
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

    expect(await screen.findByText("src/Engine.kt")).toBeInTheDocument();
    expect(screen.getByText("files lose their last author")).toBeInTheDocument();
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
    expect(screen.queryByText("Files at risk")).not.toBeInTheDocument();
  });
});

describe("OffboardingPage with the members of the project", () => {
  it("ranks the member who was chosen by every name the history knows them by", async () => {
    let leaving: string[] = [];
    server.use(
      http.get("/api/v1/projects/proj1/offboarding/identities/members", () =>
        HttpResponse.json({
          matched: 1,
          total: 1,
          members: [
            {
              member: "u1",
              displayName: "Ada Lovelace",
              githubLogin: "ada-lovelace",
              matched: true,
              identities: [
                { identity: "ada-lovelace", person: "ada-lovelace", touches: {}, lastSeenAt: "x" },
                {
                  identity: "ada@example.com",
                  person: "ada@example.com",
                  touches: {},
                  lastSeenAt: "x",
                },
              ],
              suggestions: [],
            },
          ],
        }),
      ),
      http.get("/api/v1/projects/proj1/offboarding/risk", ({ request }) => {
        leaving = new URL(request.url).searchParams.getAll("leaving");
        return HttpResponse.json(map);
      }),
    );
    render(
      <MemoryRouter>
        <OffboardingPage />
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText(/Ada Lovelace/));
    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(await screen.findByText("files lose their last author")).toBeInTheDocument();
    expect(leaving).toEqual(["ada-lovelace", "ada@example.com"]);
  });

  it("falls back to typing when the members cannot be loaded", async () => {
    server.use(
      http.get("/api/v1/projects/proj1/offboarding/identities/members", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    render(
      <MemoryRouter>
        <OffboardingPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/team could not be loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Who is leaving?")).toBeInTheDocument();
  });

  it("plans the interview of the departure ranked under Ranking", async () => {
    server.use(http.get("/api/v1/projects/proj1/offboarding/risk", () => HttpResponse.json(map)));
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "Interview" }));
    expect(screen.getByText("Nobody named yet")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Ranking" }));
    await rankFor(user, "ada");
    await user.click(screen.getByRole("button", { name: "Interview" }));

    expect(screen.getByRole("button", { name: /plan the interview/i })).toBeVisible();
    expect(screen.queryByText("src/Engine.kt")).not.toBeVisible();
  });
});
