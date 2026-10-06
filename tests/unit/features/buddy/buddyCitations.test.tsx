import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BuddyConversation } from "../../../../src/features/buddy/components/BuddyConversation";
import { BuddyDraftContext } from "../../../../src/features/buddy/buddyDraftContext";
import type { BuddyMessageView } from "../../../../src/features/buddy/types";
import type { Citation, SelectedCitation } from "../../../../src/features/buddy/citations/types";
import type { CitationArtifactOpen } from "../../../../src/features/buddy/citations/citationArtifact";

/**
 * What a buddy reply does with its sources: the `[N]` references the mentor writes become
 * interactive, the footer lists the files, and both lead to the same two destinations the chat
 * offered — the popover for a reference, the artifact drawer for a file. The footer and the
 * popover have their own component suites (in `citations/`); this file is the wiring between a
 * reply's citations and those controls, which is what was missing before slice 2c.
 */

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1", canManageSelected: false }),
}));

vi.mock("../../../../src/context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "u1", firstName: "Test", lastName: "User", profileIcon: null },
  }),
}));

const README: Citation = {
  artifactId: "a1",
  filename: "README.md",
  sourceUrl: "https://github.com/example/repo/blob/main/README.md",
  startLine: 12,
};

function renderConversation(
  messages: BuddyMessageView[],
  handlers: {
    onCitationClick?: (citation: SelectedCitation) => void;
    onOpenArtifact?: (data: CitationArtifactOpen) => void;
  } = {},
) {
  return render(
    <BuddyDraftContext.Provider value={{ draft: "", setDraft: vi.fn(), handleSubmit: vi.fn() }}>
      <BuddyConversation
        messages={messages}
        isThinking={false}
        activeTool={null}
        confirmAction={vi.fn()}
        dismissAction={vi.fn()}
        actionDrafts={{}}
        setActionDraft={vi.fn()}
        openError={null}
        onCitationClick={handlers.onCitationClick}
        onOpenArtifact={handlers.onOpenArtifact}
      />
    </BuddyDraftContext.Provider>,
  );
}

const REPLY: BuddyMessageView = {
  id: "m2",
  role: "ASSISTANT",
  content: "The setup lives in the readme [1].",
  createdAt: "2026-10-01T09:00:01.000Z",
  citations: [README],
};

describe("a reply's sources", () => {
  it("renders the sources the reply was read back with", () => {
    renderConversation([REPLY]);

    // The footer is there, collapsed…
    expect(screen.getByRole("button", { name: /Sources · 1/ })).toBeInTheDocument();
    // …and the `[N]` the mentor wrote is an interactive reference, not literal text.
    expect(screen.getByRole("button", { name: "Citation 1: README.md" })).toBeInTheDocument();
  });

  it("hands a [N] click to the surface, with the source it names", async () => {
    const onCitationClick = vi.fn();
    renderConversation([REPLY], { onCitationClick });

    await userEvent.click(screen.getByRole("button", { name: "Citation 1: README.md" }));

    expect(onCitationClick).toHaveBeenCalledTimes(1);
    expect(onCitationClick.mock.calls[0][0].citation).toEqual(README);
  });

  it("hands a file from the footer to the artifact drawer", async () => {
    const onOpenArtifact = vi.fn();
    renderConversation([REPLY], { onOpenArtifact });

    await userEvent.click(screen.getByRole("button", { name: /Sources · 1/ }));
    await userEvent.click(screen.getByRole("button", { name: "README.md" }));
    await userEvent.click(screen.getByRole("button", { name: /Open source/ }));

    expect(onOpenArtifact).toHaveBeenCalledWith({
      artifactId: "a1",
      filename: "README.md",
      sourceUrl: README.sourceUrl,
      lines: [12],
    });
  });

  it("leaves brackets alone in a reply that has no sources", () => {
    renderConversation([
      {
        id: "m2",
        role: "ASSISTANT",
        content: "Index it as arr[1] in code.",
        createdAt: "2026-10-01T09:00:01.000Z",
      },
    ]);

    expect(screen.queryByRole("button", { name: "Citation 1: README.md" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sources/ })).not.toBeInTheDocument();
  });
});
