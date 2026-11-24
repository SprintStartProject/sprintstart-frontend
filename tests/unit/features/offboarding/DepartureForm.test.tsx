import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DepartureForm } from "../../../../src/features/offboarding";
import type { TeamState } from "../../../../src/features/offboarding/components/WhoIsLeaving";
import type { MemberMatch } from "../../../../src/services/offboardingTypes";

const NO_TEAM: TeamState = { members: [], loading: false, failed: false };

function setup(busy = false, team: TeamState = NO_TEAM) {
  const onSubmit = vi.fn();
  render(<DepartureForm team={team} busy={busy} onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

function member(id: string, name: string, login: string | null, names: string[]): MemberMatch {
  return {
    member: id,
    displayName: name,
    githubLogin: login,
    matched: names.length > 0,
    identities: names.map((identity) => ({
      identity,
      person: identity,
      touches: { commits: 3 },
      lastSeenAt: "2026-11-01T00:00:00Z",
    })),
    suggestions: [],
  };
}

const TEAM: TeamState = {
  members: [
    member("u1", "Ada Lovelace", "ada-lovelace", ["ada-lovelace", "ada@example.com"]),
    member("u2", "Ben Franklin", null, ["ben@example.com"]),
    member("u3", "Newcomer", "newcomer", []),
  ],
  loading: false,
  failed: false,
};

describe("DepartureForm", () => {
  it("tells a member who went quiet from the others", () => {
    const quiet = {
      ...member("u9", "Quiet Quinn", null, ["quinn@example.com"]),
      inactive: true,
      lastSeenAt: "2025-03-12T00:00:00Z",
    };
    setup(false, { members: [quiet, ...TEAM.members], loading: false, failed: false });

    expect(screen.getByText(/Inactive since 12 Mar 2025/)).toBeInTheDocument();
    expect(screen.getAllByText(/Inactive since/)).toHaveLength(1);
  });

  it("does not mark an active member or one without a last trace as inactive", () => {
    const odd = {
      ...member("u8", "Odd Olly", null, ["olly@example.com"]),
      inactive: true,
      lastSeenAt: null,
    };
    setup(false, { members: [odd, ...TEAM.members], loading: false, failed: false });

    expect(screen.queryByText(/Inactive since/)).not.toBeInTheDocument();
  });

  it("adds a typed person as a chip and clears the field", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada@example.com{Enter}");

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Who is leaving?")).toHaveValue("");
  });

  it("adds several pasted people at once", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText("Who is leaving?"));
    await user.paste("ada, ben carol");
    await user.click(screen.getByRole("button", { name: "Add person" }));

    const chips = screen.getByRole("list", { name: "People who are leaving" });
    expect(chips).toHaveTextContent("ada");
    expect(chips).toHaveTextContent("ben");
    expect(chips).toHaveTextContent("carol");
  });

  it("draws an icon on the buttons that add and remove a person", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: "Add person" }).querySelector("svg")).not.toBeNull();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");

    expect(screen.getByRole("button", { name: "Remove ada" }).querySelector("svg")).not.toBeNull();
  });

  it("removes a person again", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}ben{Enter}");

    await user.click(screen.getByRole("button", { name: "Remove ada" }));

    expect(screen.queryByText("ada")).not.toBeInTheDocument();
    expect(screen.getByText("ben")).toBeInTheDocument();
  });

  it("does not submit without anybody leaving and says why", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one person");
  });

  it("submits the departure with its date and review weight", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.type(screen.getByLabelText("As of"), "2026-11-20");
    await user.type(screen.getByLabelText("Review weight"), "0.5");

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith({
      leaving: ["ada"],
      asOf: "2026-11-20T23:59:59Z",
      reviewWeight: 0.5,
      limit: 200,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits the chosen ranking and knowledge model", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.selectOptions(screen.getByLabelText("Rank files by"), "placeholder");
    await user.selectOptions(screen.getByLabelText("Who knows a file"), "time-weighted");

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith({
      leaving: ["ada"],
      ranking: "placeholder",
      knowledge: "time-weighted",
      limit: 200,
    });
  });

  it("refuses a negative review weight", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");
    await user.type(screen.getByLabelText("Review weight"), "-1");

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("review weight");
  });

  it("adds nothing for blank input and for keys other than Enter", async () => {
    const { user } = setup();
    const field = screen.getByLabelText("Who is leaving?");

    await user.type(field, "   {Enter}");
    await user.type(field, "ada");

    expect(screen.queryByRole("list", { name: "People who are leaving" })).not.toBeInTheDocument();
    expect(field).toHaveValue("   ada");
  });

  it("does not submit the departure when Enter only adds a person", async () => {
    const { user, onSubmit } = setup();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}ben{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("ben")).toBeInTheDocument();
  });

  it("does not complain before the first attempt and stops once the problem is fixed", async () => {
    const { user, onSubmit } = setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Who is leaving?"), "ada{Enter}");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rank files" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the button as busy while a ranking is being computed", () => {
    setup(true);

    expect(screen.getByRole("button", { name: "Rank files" })).toBeDisabled();
  });
});

describe("DepartureForm with the members of the project", () => {
  it("offers each member with their login and how much of the history is theirs", () => {
    setup(false, TEAM);

    expect(screen.getByRole("group", { name: "Who is leaving?" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText("@ada-lovelace")).toBeInTheDocument();
    expect(screen.getByText("2 names in the history")).toBeInTheDocument();
    expect(screen.getByText("1 name in the history")).toBeInTheDocument();
  });

  it("cannot choose a member the history knows nothing about and says why", () => {
    setup(false, TEAM);

    expect(screen.getByLabelText(/Newcomer/)).toBeDisabled();
    expect(screen.getByText(/cannot be ranked/)).toBeInTheDocument();
  });

  it("sends every name of a chosen member", async () => {
    const { user, onSubmit } = setup(false, TEAM);

    await user.click(screen.getByLabelText(/Ada Lovelace/));
    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ leaving: ["ada-lovelace", "ada@example.com"] }),
    );
  });

  it("takes a member back out again", async () => {
    const { user, onSubmit } = setup(false, TEAM);
    await user.click(screen.getByLabelText(/Ada Lovelace/));
    await user.click(screen.getByLabelText(/Ben Franklin/));

    await user.click(screen.getByLabelText(/Ada Lovelace/));
    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ leaving: ["ben@example.com"] }),
    );
  });

  it("still takes somebody the list does not offer", async () => {
    const { user, onSubmit } = setup(false, TEAM);
    await user.click(screen.getByLabelText(/Ben Franklin/));

    await user.type(screen.getByLabelText("Someone who is not listed?"), "zed@x.org{Enter}");
    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ leaving: ["ben@example.com", "zed@x.org"] }),
    );
  });

  it("asks to choose somebody when nobody is chosen", async () => {
    const { user, onSubmit } = setup(false, TEAM);

    await user.click(screen.getByRole("button", { name: "Rank files" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one person");
  });

  it("says the team is loading and keeps typing possible", () => {
    setup(false, { members: [], loading: true, failed: false });

    expect(screen.getByRole("status")).toHaveTextContent("Loading the team");
    expect(screen.getByLabelText("Who is leaving?")).toBeInTheDocument();
  });

  it("says the team could not be loaded and falls back to typing", () => {
    setup(false, { members: [], loading: false, failed: true });

    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
    expect(screen.getByLabelText("Who is leaving?")).toBeInTheDocument();
  });

  it("offers no list when the project has no members", () => {
    setup();

    expect(screen.queryByRole("group", { name: "Who is leaving?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
