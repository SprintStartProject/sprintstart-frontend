import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtifactContentBody } from "../../../../../src/features/knowledge-base/components/ArtifactContentBody";
import { CitedChunkBanner } from "../../../../../src/features/knowledge-base/components/CitedChunkBanner";
import { DeleteArtifactDialog } from "../../../../../src/features/knowledge-base/components/DeleteArtifactDialog";
import { DrawerActions } from "../../../../../src/features/knowledge-base/components/DrawerActions";
import { createMarkdownComponents } from "../../../../../src/features/knowledge-base/components/markdownComponents";
import { SummaryView } from "../../../../../src/features/knowledge-base/components/SummaryView";
import type { Artifact, ArtifactContent } from "../../../../../src/features/knowledge-base/types";

function artifact(title = "notes.md"): Artifact {
  return {
    id: "a-1",
    title,
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "s-1",
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2026-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: "h",
    ingestionRunId: null,
  };
}

function content(value: string, mimeType = "text/plain"): ArtifactContent {
  return { content: value, mimeType, isObjectUrl: false };
}

describe("DrawerActions", () => {
  function renderActions(overrides: Partial<Parameters<typeof DrawerActions>[0]> = {}) {
    const handlers = {
      onMarkdownViewMode: vi.fn(),
      onAsk: vi.fn(),
      onSummarize: vi.fn(),
      onDelete: vi.fn(),
    };
    render(
      <DrawerActions
        showMarkdownSwitch={false}
        markdownViewMode="rendered"
        hasSelection={false}
        summariseBlockedReason={null}
        canDelete={false}
        isDeleting={false}
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  }

  it("offers ask and summarise, and nothing else, by default", () => {
    renderActions();

    expect(screen.getByTestId("ask-ai-btn")).toHaveTextContent("Ask AI");
    expect(screen.getByTestId("summarise-btn")).not.toBeDisabled();
    expect(screen.queryByTestId("view-rendered-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("delete-artifact-btn")).not.toBeInTheDocument();
  });

  it("names the selection in the ask button", () => {
    renderActions({ hasSelection: true });

    expect(screen.getByTestId("ask-ai-btn")).toHaveTextContent("Ask AI about this");
  });

  it("calls back for ask, summarise and delete", () => {
    const handlers = renderActions({ canDelete: true });

    fireEvent.click(screen.getByTestId("ask-ai-btn"));
    fireEvent.click(screen.getByTestId("summarise-btn"));
    fireEvent.click(screen.getByTestId("delete-artifact-btn"));

    expect(handlers.onAsk).toHaveBeenCalledTimes(1);
    expect(handlers.onSummarize).toHaveBeenCalledTimes(1);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables summarise with the reason as tooltip and accessible name", () => {
    const handlers = renderActions({ summariseBlockedReason: "Too short" });

    const button = screen.getByTestId("summarise-btn");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName("Summarise (unavailable: Too short)");
    expect(button.parentElement).toHaveAttribute("title", "Too short");
    fireEvent.click(button);
    expect(handlers.onSummarize).not.toHaveBeenCalled();
  });

  it("gives an available summarise button neither tooltip nor extra name", () => {
    renderActions();

    const button = screen.getByTestId("summarise-btn");
    expect(button).toHaveAccessibleName("Summarise");
    expect(button.parentElement).not.toHaveAttribute("title");
  });

  it("locks the delete button while a deletion runs", () => {
    renderActions({ canDelete: true, isDeleting: true });

    expect(screen.getByTestId("delete-artifact-btn")).toBeDisabled();
  });

  it("switches the markdown view and marks the active one", () => {
    const handlers = renderActions({ showMarkdownSwitch: true, markdownViewMode: "source" });

    expect(screen.getByTestId("view-source-btn").className).toContain("shadow-xs");
    expect(screen.getByTestId("view-rendered-btn").className).not.toContain("shadow-xs");
    fireEvent.click(screen.getByTestId("view-rendered-btn"));
    fireEvent.click(screen.getByTestId("view-source-btn"));

    expect(handlers.onMarkdownViewMode.mock.calls).toEqual([["rendered"], ["source"]]);
  });
});

describe("DeleteArtifactDialog", () => {
  function renderDialog(overrides: Partial<Parameters<typeof DeleteArtifactDialog>[0]> = {}) {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteArtifactDialog
        isOpen={true}
        artifactTitle="report.pdf"
        isDeleting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...overrides}
      />,
    );
    return { onCancel, onConfirm };
  }

  it("names the artifact and warns that it cannot be undone", () => {
    renderDialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/permanently remove "report\.pdf"/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it.each([undefined, null])("falls back to a generic name for the title %j", (title) => {
    renderDialog({ artifactTitle: title });

    expect(screen.getByText(/permanently remove "this artifact"/)).toBeInTheDocument();
  });

  it("calls back for cancel and confirm", () => {
    const { onCancel, onConfirm } = renderDialog();

    fireEvent.click(screen.getByTestId("cancel-delete-btn"));
    fireEvent.click(screen.getByTestId("confirm-delete-btn"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows progress and locks both buttons while deleting", () => {
    renderDialog({ isDeleting: true });

    expect(screen.getByTestId("confirm-delete-btn")).toHaveTextContent("Deleting...");
    expect(screen.getByTestId("confirm-delete-btn")).toBeDisabled();
    expect(screen.getByTestId("cancel-delete-btn")).toBeDisabled();
  });

  it("is absent while closed", () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("CitedChunkBanner", () => {
  it("names the cited lines and jumps on request", () => {
    const onJump = vi.fn();
    render(<CitedChunkBanner highlightLines={[4, 9]} onJump={onJump} />);

    expect(screen.getByText("Showing cited chunk (Lines 4–9)")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("jump-to-chunk-btn"));
    expect(onJump).toHaveBeenCalledTimes(1);
  });
});

describe("SummaryView", () => {
  function renderSummary(overrides: Partial<Parameters<typeof SummaryView>[0]> = {}) {
    const handlers = { onRetry: vi.fn(), onBack: vi.fn() };
    render(
      <SummaryView
        summary=""
        citations={[]}
        error={null}
        isFetchingSummary={false}
        isIndexing={false}
        stageDetail={undefined}
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  }

  it("heads the summary", () => {
    renderSummary({ summary: "Done." });

    expect(screen.getByTestId("summary-content")).toBeInTheDocument();
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText("Done.")).toBeInTheDocument();
  });

  it.each([
    [{ isFetchingSummary: true }, "Generating summary..."],
    [{ isFetchingSummary: true, isIndexing: true }, "Preparing summary..."],
    [{ isFetchingSummary: true, isIndexing: true, stageDetail: "Reading..." }, "Reading..."],
  ])("waits with %j showing %s", (props, message) => {
    renderSummary(props);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("shows the text, not the wait, once tokens have arrived", () => {
    renderSummary({ isFetchingSummary: true, summary: "Partial" });

    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.queryByText("Generating summary...")).not.toBeInTheDocument();
  });

  it("shows the failure with retry and back", () => {
    const handlers = renderSummary({ error: "Model down" });

    expect(screen.getByText("Model down")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("retry-summary-btn"));
    fireEvent.click(screen.getByRole("button", { name: /back to file/i }));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });

  it("lists the citations under the text", () => {
    renderSummary({
      summary: "Text",
      citations: [{ artifactId: "c-1", filename: "source.md", sourceUrl: null }],
    });

    expect(screen.getByText(/source\.md/)).toBeInTheDocument();
  });

  it("shows the game hint and box it is given, above the body", () => {
    renderSummary({
      summary: "Text",
      gameHint: <div data-testid="hint" />,
      gameBox: <div data-testid="box" />,
    });

    const hint = screen.getByTestId("hint");
    const box = screen.getByTestId("box");
    const text = screen.getByText("Text");
    expect(hint.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no game slots by default", () => {
    renderSummary({ summary: "Text" });

    expect(screen.getByTestId("summary-content").children).toHaveLength(2);
  });
});

describe("ArtifactContentBody", () => {
  const markdownComponents = createMarkdownComponents();

  function renderBody(overrides: Partial<Parameters<typeof ArtifactContentBody>[0]> = {}) {
    return render(
      <ArtifactContentBody
        kind="source"
        content={content("const a = 1;")}
        artifact={artifact("app.ts")}
        isMarkdownArtifact={false}
        markdownComponents={markdownComponents}
        {...overrides}
      />,
    ).container;
  }

  it("lists source with line numbers, in the language of the file", () => {
    const container = renderBody();

    expect(container.querySelector("code[class*='language-typescript']")).toBeInTheDocument();
    expect(container.querySelector(".react-syntax-highlighter-line-number")).toBeInTheDocument();
  });

  it("lists markdown artifacts' source as markdown", () => {
    const container = renderBody({ isMarkdownArtifact: true, artifact: artifact("notes.md") });

    expect(container.querySelector("code[class*='language-markdown']")).toBeInTheDocument();
  });

  it("anchors and marks the cited source lines", () => {
    const container = renderBody({
      content: content("one\ntwo\nthree"),
      highlightLines: [2],
    });

    expect(container.querySelector("#line-1")).not.toBeNull();
    expect(container.querySelector("#line-2")?.className).toContain("border-app-brand");
    expect(container.querySelector("#line-1")?.className).not.toContain("border-app-brand");
  });

  it("lists an empty source while nothing is loaded", () => {
    const container = renderBody({ content: null });

    expect(container.querySelector("code")?.textContent).toBe("");
  });

  it("renders markdown formatted", () => {
    const container = renderBody({
      kind: "markdown",
      content: content("# Title", "text/markdown"),
      artifact: artifact("notes.md"),
    });

    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector(".prose")).toBeInTheDocument();
  });

  it("explains an empty body", () => {
    renderBody({ kind: "empty", content: content("") });

    expect(screen.getByTestId("empty-body-notice")).toBeInTheDocument();
    expect(screen.getByText("Nothing to read here")).toBeInTheDocument();
  });

  it("embeds a pdf with a download link as fallback", () => {
    const container = renderBody({
      kind: "pdf",
      content: content("blob:pdf", "application/pdf"),
      artifact: artifact("report.pdf"),
    });

    expect(container.querySelector("object")).toHaveAttribute("data", "blob:pdf");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "download",
      "report.pdf",
    );
  });

  it("names the pdf download after the document when the artifact has no title", () => {
    renderBody({
      kind: "pdf",
      content: content("blob:pdf", "application/pdf"),
      artifact: artifact(""),
    });

    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "download",
      "document.pdf",
    );
  });

  it("shows an image with the title as alt text", () => {
    renderBody({
      kind: "image",
      content: content("blob:img", "image/png"),
      artifact: artifact("photo.png"),
    });

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "blob:img");
    expect(image).toHaveAttribute("alt", "photo.png");
  });

  it("gives an untitled image a generic alt text", () => {
    renderBody({
      kind: "image",
      content: content("blob:img", "image/png"),
      artifact: artifact(""),
    });

    expect(screen.getByRole("img")).toHaveAttribute("alt", "Image");
  });

  it("falls back to source when a kind needs content that is missing", () => {
    const container = renderBody({ kind: "pdf", content: null });

    expect(container.querySelector("object")).toBeNull();
    expect(container.querySelector("code")).toBeInTheDocument();
  });
});
