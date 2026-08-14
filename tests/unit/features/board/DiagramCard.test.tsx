import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiagramCard } from "../../../../src/features/board/components/DiagramCard";
import { boardService } from "../../../../src/services/boardService";
import type { BoardCard, DiagramContent } from "../../../../src/features/board/types";

vi.mock("../../../../src/services/boardService", () => ({
  boardService: { refreshDiagram: vi.fn() },
}));

const refreshDiagram = vi.mocked(boardService.refreshDiagram);

const card: Pick<BoardCard, "id" | "owner" | "placedAt"> = {
  id: "card-1",
  owner: "AI",
  placedAt: "2026-07-27T10:00:00Z",
};

const content = (over: Partial<DiagramContent> = {}): DiagramContent => ({
  kind: "DIAGRAM",
  subject: "how a request reaches the database",
  summary: "A request lands on the controller and ends at the repository.",
  nodes: [
    {
      id: "controller",
      label: "ReportController",
      kind: "COMPONENT",
      summary: "Receives the HTTP request.",
      citations: [
        { filename: "ReportController.kt", sourceUrl: "https://example.test/Controller" },
      ],
    },
    {
      id: "repo",
      label: "ReportRepository",
      kind: "COMPONENT",
      summary: null,
      citations: [{ filename: "ReportRepository.kt", sourceUrl: null }],
    },
  ],
  edges: [{ fromId: "controller", toId: "repo", kind: "FLOWS_TO", label: null }],
  sources: [{ filename: "ReportController.kt", sourceUrl: null, artifactType: null }],
  assembledAt: "2026-07-26T08:00:00Z",
  reason: null,
  ...over,
});

/** The card revalidates on mount, so every test settles that before asserting. */
async function renderCard(initial = content(), fresh: DiagramContent | Error = initial) {
  if (fresh instanceof Error) refreshDiagram.mockRejectedValue(fresh);
  else refreshDiagram.mockResolvedValue(fresh);

  render(<DiagramCard content={initial} card={card} />);
  await waitFor(() => expect(refreshDiagram).toHaveBeenCalledWith("card-1"));
}

describe("DiagramCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the question the buddy asked, not just the answer", async () => {
    await renderCard();

    // The subject is the one thing the model chose, so the hire gets to see what was asked.
    expect(screen.getByText("how a request reaches the database")).toBeInTheDocument();
  });

  it("dates the picture, because it is a claim about code at a moment", async () => {
    await renderCard();

    await waitFor(() => expect(screen.getByText(/Drawn from this project/)).toBeInTheDocument());
  });

  it("checks the picture is still current when it mounts", async () => {
    await renderCard();

    expect(refreshDiagram).toHaveBeenCalledTimes(1);
  });

  it("keeps the last picture when the check cannot be made", async () => {
    await renderCard(content(), new Error("offline"));

    // The board handed us a dated picture. Failing to confirm it is current is not a reason to
    // take it away.
    await waitFor(() => expect(screen.getByText(/Drawn from this project/)).toBeInTheDocument());
  });

  it("shows a redrawn picture over the one the board served", async () => {
    await renderCard(
      content(),
      content({
        nodes: [
          {
            id: "filter",
            label: "AuthFilter",
            kind: "COMPONENT",
            summary: null,
            citations: [{ filename: "AuthFilter.kt", sourceUrl: null }],
          },
        ],
        edges: [],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Read it as a list" }));
    await waitFor(() => expect(screen.getByText("AuthFilter")).toBeInTheDocument());
  });

  it("reads as a list as well as a picture, with every source openable", async () => {
    await renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Read it as a list" }));

    const list = screen.getByTestId("diagram-list");
    expect(list).toHaveTextContent("ReportController");
    // The relationship, in a sentence -- the canvas can only draw it.
    expect(list).toHaveTextContent("ReportController goes to ReportRepository");
    expect(screen.getByRole("link", { name: "ReportController.kt" })).toHaveAttribute(
      "href",
      "https://example.test/Controller",
    );
  });

  it("names a source that cannot be opened rather than dropping it", async () => {
    await renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Read it as a list" }));

    // Unopenable beats unattributed: the box is still checkable by name.
    expect(screen.getByTestId("diagram-list")).toHaveTextContent("ReportRepository.kt");
    expect(screen.queryByRole("link", { name: "ReportRepository.kt" })).not.toBeInTheDocument();
  });

  it("skips an arrow pointing at a box that is not in the diagram", async () => {
    await renderCard(
      content({
        edges: [
          { fromId: "controller", toId: "repo", kind: "FLOWS_TO", label: null },
          { fromId: "controller", toId: "ghost", kind: "FLOWS_TO", label: null },
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Read it as a list" }));

    const arrows = screen.getByTestId("diagram-list").textContent ?? "";
    expect(arrows).toContain("ReportController goes to ReportRepository");
    expect(arrows).not.toContain("ghost");
  });

  it("says why there is no picture rather than showing an empty frame", async () => {
    await renderCard(
      content({
        nodes: [],
        edges: [],
        assembledAt: null,
        reason: "Nothing in this project’s material describes that closely enough to draw",
        summary: null,
      }),
    );

    expect(screen.getByText(/describes that closely enough/)).toBeInTheDocument();
    // Nothing to switch between, so the toggle is not offered.
    expect(screen.queryByRole("button", { name: "Read it as a list" })).not.toBeInTheDocument();
  });

  it("offers the conversation the diagram came out of", async () => {
    await renderCard();

    expect(screen.getByRole("button", { name: /Ask about this diagram/ })).toBeInTheDocument();
  });
});
