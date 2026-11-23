import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { FileTree } from "../../../../src/features/offboarding/components/FileTree";
import type { FileRisk } from "../../../../src/services/offboardingTypes";

function file(repository: string, path: string, overrides: Partial<FileRisk> = {}): FileRisk {
  return {
    repository,
    path,
    level: "ORPHANED",
    score: 0.8,
    departingShare: 1,
    sourceBreakdown: { commits: 0.5, reviews: 0.75 },
    recentActivity: 0.4,
    fragmentation: 0,
    remainingKnowers: [],
    lastChangedAt: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

const FILES = [
  file("github:acme/app", "src/ingestion/Reader.kt"),
  file("github:acme/app", "src/ingestion/Writer.kt", {
    level: "HOARDED",
    remainingKnowers: ["ben"],
    score: 0.4,
  }),
  file("github:acme/app", "src/buddy/Runner.kt", { score: 0.6 }),
  file("local-repo", "notes/Plan.md", { score: 0.2 }),
];

const button = (name: RegExp | string) => screen.getByRole("button", { name });

describe("FileTree", () => {
  it("names the tree and shows each repository with how many files below it nobody will know", () => {
    render(<FileTree files={FILES} />);

    expect(screen.getByRole("list", { name: "Files at risk by folder" })).toBeInTheDocument();
    expect(
      button("acme/app, 3 files at risk, 2 nobody left, 1 one person left"),
    ).toBeInTheDocument();
    expect(button("local-repo, 1 file at risk, 1 nobody left")).toBeInTheDocument();
  });

  it("starts with every folder open for a short ranking, files named by what they are", () => {
    render(<FileTree files={FILES} />);

    expect(button("src/ingestion/Reader.kt, Nobody left, risk 80%")).toBeInTheDocument();
    expect(button("src/ingestion/Writer.kt, One person left, risk 40%")).toBeInTheDocument();
    expect(button("notes/Plan.md, Nobody left, risk 20%")).toBeInTheDocument();
  });

  it("shows the name of a file in its folder and its risk", () => {
    render(<FileTree files={FILES} />);

    const reader = button(/Reader\.kt/);
    expect(within(reader).getByText("Reader.kt")).toBeInTheDocument();
    expect(within(reader).getByText("80%")).toBeInTheDocument();
  });

  it("closes a folder and opens it again", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);
    const app = button(/^acme\/app,/);

    await user.click(app);
    expect(app).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Reader\.kt/ })).not.toBeInTheDocument();
    await user.click(app);

    expect(app).toHaveAttribute("aria-expanded", "true");
    expect(button(/Reader\.kt/)).toBeInTheDocument();
  });

  it("selects a file, shows it below and takes the selection back on the second click", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);
    const writer = button(/Writer\.kt/);

    await user.click(writer);
    expect(writer).toHaveAttribute("aria-pressed", "true");
    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).getByText("src/ingestion/Writer.kt")).toBeInTheDocument();
    expect(within(details).getByText("Stays: ben")).toBeInTheDocument();
    await user.click(writer);

    expect(writer).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("status", { name: "Selected file" })).not.toBeInTheDocument();
  });

  it("offers the selected file and its history at their source", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);

    await user.click(button(/Reader\.kt/));

    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).getByRole("link", { name: /Open on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/app/blob/HEAD/src/ingestion/Reader.kt",
    );
    expect(within(details).getByRole("link", { name: /History/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/app/commits/HEAD/src/ingestion/Reader.kt",
    );
  });

  it("says why the selected file is at risk and how its knowledge is spread", async () => {
    const user = userEvent.setup();
    const why = ["Nobody who knows it is left.", "It last changed 14 months ago."];
    const withReasons = file("github:acme/app", "src/A.kt", {
      reasons: why,
      concentration: { effectiveKnowers: 1.14, island: "ada" },
    });
    render(<FileTree files={[withReasons]} />);

    await user.click(button(/A\.kt/));

    const details = screen.getByRole("status", { name: "Selected file" });
    const list = within(details).getByRole("list", { name: "Why this file is at risk" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(why);
    expect(
      within(details).getByText(/Worth 1\.1 equally strong knowers, a knowledge island: ada/),
    ).toBeInTheDocument();
  });

  it("names who could take the file over and the files it changes together with", async () => {
    const user = userEvent.setup();
    const handover = file("github:acme/app", "src/A.kt", {
      successors: [
        { person: "ben@x.org", score: 12 },
        { person: "carol@x.org", score: 6 },
      ],
      coupling: {
        sum: 1.5,
        partners: [{ repository: "github:acme/app", path: "src/Parser.kt", degree: 0.82 }],
      },
    });
    render(<FileTree files={[handover]} />);

    await user.click(button(/A\.kt/));

    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).getByText("ben@x.org, carol@x.org")).toBeInTheDocument();
    expect(within(details).getByText("src/Parser.kt (82%)")).toBeInTheDocument();
  });

  it("shows only what it has of the handover", async () => {
    const user = userEvent.setup();
    const onlySuccessor = file("github:acme/app", "src/A.kt", {
      successors: [{ person: "ben", score: 3 }],
    });
    render(<FileTree files={[onlySuccessor]} />);

    await user.click(button(/A\.kt/));

    expect(screen.getByText("Could take over:")).toBeInTheDocument();
    expect(screen.queryByText("Changes together with:")).not.toBeInTheDocument();
  });

  it("shows no reasons for a map stored before there were any", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);

    await user.click(button(/Reader\.kt/));

    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).queryByRole("list")).not.toBeInTheDocument();
    expect(within(details).queryByText(/equally strong/)).not.toBeInTheDocument();
  });

  it("names a spread without an island by its knowers only", async () => {
    const user = userEvent.setup();
    const shared = file("github:acme/app", "src/A.kt", {
      concentration: { effectiveKnowers: 2, island: null },
    });
    render(<FileTree files={[shared]} />);

    await user.click(button(/A\.kt/));

    expect(screen.getByText("Worth 2.0 equally strong knowers")).toBeInTheDocument();
  });

  it("offers a Bitbucket file without a history", async () => {
    const user = userEvent.setup();
    render(<FileTree files={[file("bitbucket:team/app", "src/A.kt")]} />);

    await user.click(button(/A\.kt/));

    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).getByRole("link", { name: /Open on Bitbucket/ })).toBeInTheDocument();
    expect(within(details).queryByRole("link", { name: /History/ })).not.toBeInTheDocument();
  });

  it("offers no links for a repository on a host it does not know", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);

    await user.click(button(/Plan\.md/));

    const details = screen.getByRole("status", { name: "Selected file" });
    expect(within(details).queryByRole("link")).not.toBeInTheDocument();
  });

  it("opens a file at its source from its row without selecting it", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);
    const link = screen.getByRole("link", { name: "Open Reader.kt on GitHub" });

    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/app/blob/HEAD/src/ingestion/Reader.kt",
    );
    expect(link).toHaveAttribute("target", "_blank");
    await user.click(link);

    expect(button(/Reader\.kt/)).toHaveAttribute("aria-pressed", "false");
  });

  it("can be used by keyboard alone, every line being a button", async () => {
    const user = userEvent.setup();
    render(<FileTree files={FILES} />);

    await user.tab();
    expect(button(/^acme\/app,/)).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(button(/^acme\/app,/)).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(button(/^acme\/app,/)).toHaveAttribute("aria-expanded", "true");
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("status", { name: "Selected file" })).toBeInTheDocument();
  });

  it("starts a longer ranking with only the repositories open", () => {
    const many = Array.from({ length: 61 }, (_, index) =>
      file("github:acme/app", `d${index}/x/F${index}.kt`),
    );

    render(<FileTree files={many} />);

    expect(button(/^acme\/app,/)).toHaveAttribute("aria-expanded", "true");
    expect(button(/^d0\/x,/)).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /F0\.kt/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(62);
  });

  it("closes the details when the selected file is no longer ranked", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FileTree files={FILES} />);
    await user.click(button(/Reader\.kt/));

    rerender(<FileTree files={FILES.slice(1)} />);

    expect(screen.queryByRole("status", { name: "Selected file" })).not.toBeInTheDocument();
  });

  it("shows nothing for no files", () => {
    render(<FileTree files={[]} />);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
