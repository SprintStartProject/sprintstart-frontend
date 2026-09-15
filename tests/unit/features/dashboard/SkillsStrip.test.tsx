import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillsStrip } from "../../../../src/features/dashboard/components/SkillsStrip";
import {
  getMySkillLevels,
  getMyTeamOverview,
} from "../../../../src/services/teamManagementService";
import type { UserSkillLevel } from "../../../../src/services/teamManagementService";

/** The roles `/users/me` carries for the signed-in user, and the ones the strip labels with. */
const PROFILE_ROLES = [
  { id: "role1", name: "Frontend" },
  { id: "role2", name: "Backend" },
];

const { mocks } = vi.hoisted(() => ({
  mocks: { projectRoles: [] as { id: string; name: string }[] },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    status: "authenticated",
    profile: { id: "u1", projectRoles: mocks.projectRoles },
  }),
}));

vi.mock("../../../../src/services/teamManagementService", () => ({
  getMySkillLevels: vi.fn(),
  getMyTeamOverview: vi.fn(),
}));

function skillLevel(id: string, name: string): UserSkillLevel {
  return {
    id,
    skillId: `skill-${id}`,
    skillName: name,
    roleName: "Unknown role",
    level: "INTERMEDIATE",
  };
}

describe("SkillsStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectRoles = [...PROFILE_ROLES];
    vi.mocked(getMyTeamOverview).mockResolvedValue({
      userId: "u1",
      firstname: "Alice",
      lastname: "Smith",
      projects: [],
      roles: [{ id: "role1", name: "Frontend", description: "" }],
      skills: [],
      progressPercentage: 0,
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: null,
      hasFeedback: false,
    });
    vi.mocked(getMySkillLevels).mockResolvedValue([skillLevel("1", "TypeScript")]);
  });

  it("labels the skill levels with the signed-in user's own roles", async () => {
    render(<SkillsStrip size="wide" />);

    await waitFor(() => expect(screen.getByText("TypeScript")).toBeInTheDocument());

    // The admin-only `/projectRoles` endpoint is never asked for; the profile roles are
    // handed to the service instead, so labelling costs no extra request.
    expect(vi.mocked(getMySkillLevels)).toHaveBeenCalledWith(PROFILE_ROLES);
  });

  it("renders the user's roles as badges alongside the skills", async () => {
    render(<SkillsStrip size="wide" />);

    await waitFor(() => expect(screen.getByText("TypeScript")).toBeInTheDocument());

    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("shows the empty state when nothing has been assessed", async () => {
    vi.mocked(getMySkillLevels).mockResolvedValue([]);

    render(<SkillsStrip size="wide" />);

    await waitFor(() => expect(screen.getByText(/No skills assessed yet/)).toBeInTheDocument());
  });

  it("summarises the skills past the visible six instead of dropping them", async () => {
    vi.mocked(getMySkillLevels).mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => skillLevel(String(index), `Skill ${index}`)),
    );

    render(<SkillsStrip size="wide" />);

    await waitFor(() => expect(screen.getByText("+2 more")).toBeInTheDocument());
    expect(screen.queryByText("Skill 7")).not.toBeInTheDocument();
  });

  it("still renders the skills before the profile roles have loaded", async () => {
    mocks.projectRoles = [];

    render(<SkillsStrip size="wide" />);

    await waitFor(() => expect(screen.getByText("TypeScript")).toBeInTheDocument());

    // Empty roles mean the labels degrade to "Unknown role" — not a failed load.
    expect(vi.mocked(getMySkillLevels)).toHaveBeenCalledWith([]);
  });
});
