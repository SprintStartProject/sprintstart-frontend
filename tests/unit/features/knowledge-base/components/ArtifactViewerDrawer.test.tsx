import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ArtifactViewerDrawer } from "../../../../../src/features/knowledge-base/components/ArtifactViewerDrawer";
import { preprocessMarkdown } from "../../../../../src/features/knowledge-base/markdown";
import { ApiError } from "../../../../../src/services/apiClient";
import type {
  Artifact,
  ArtifactSummaryCitation,
  SummaryStreamHandlers,
} from "../../../../../src/features/knowledge-base/types";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactContent: vi.fn().mockResolvedValue({
      content: "# Test content",
      mimeType: "text/markdown",
    }),
    streamArtifactSummary: vi.fn(),
    deleteUpload: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "remover-1" } }),
}));

vi.mock("../../../../../src/components/ui/SidePanel", () => ({
  SidePanel: ({
    isOpen,
    title,
    actions,
    children,
  }: {
    isOpen: boolean;
    title: React.ReactNode;
    actions: React.ReactNode;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="side-panel">
        <div data-testid="panel-header">{title}</div>
        <div data-testid="panel-actions">{actions}</div>
        {children}
      </div>
    ) : null,
}));

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "artifact-1",
    title: "README.md",
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "src-1",
    sourceUrl: null,
    mime: "text/markdown",
    language: "Markdown",
    ingestedAt: "2026-01-01T00:00:00Z",
    createdAtSource: null,
    updatedAtSource: null,
    contentHash: "hash123",
    ingestionRunId: null,
    ...overrides,
  };
}

function renderDrawer(
  artifact: Artifact | null = createArtifact(),
  overrides: {
    canDelete?: boolean;
    onDelete?: (id: string) => void;
    highlightLines?: number[];
  } = {},
) {
  const onDelete = overrides.onDelete ?? vi.fn();
  return {
    onDelete,
    // Delete outcomes are toasts now, so the drawer needs a ToastProvider.
    ...rtlRender(
      <ArtifactViewerDrawer
        artifact={artifact}
        onClose={() => {}}
        projectId="proj-1"
        highlightLines={overrides.highlightLines}
        canDelete={overrides.canDelete ?? false}
        onDelete={onDelete}
      />,
      { wrapper: ToastProvider },
    ),
  };
}

/**
 * Builds a streamArtifactSummary implementation that resolves the stream immediately
 * by invoking the captured handlers with the given token/citations/done sequence.
 */
function streamingSuccess(summary: string, citations: ArtifactSummaryCitation[] = []) {
  return (_projectId: string, _artifactId: string, handlers: SummaryStreamHandlers) => {
    handlers.onToken(summary);
    for (const citation of citations) {
      handlers.onCitation(citation);
    }
    handlers.onDone();
    return Promise.resolve();
  };
}

describe("ArtifactViewerDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows a spinner while fetching the summary", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary).mockReturnValue(new Promise(() => {}));

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    expect(screen.getByText("Generating summary...")).toBeInTheDocument();
  });

  it("renders the streamed summary markdown and citations on success", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(
      streamingSuccess("## Key points\nThis is the summary.", [
        {
          artifactId: "artifact-1",
          filename: "README.md",
          sourceUrl: "https://github.com/owner/repo/blob/main/README.md",
        },
      ]),
    );

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    expect(await screen.findByTestId("summary-content")).toBeInTheDocument();
    expect(screen.getByText("Key points")).toBeInTheDocument();
    expect(screen.getByTestId("summary-citations")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "README.md" })).toHaveAttribute(
      "href",
      "https://github.com/owner/repo/blob/main/README.md",
    );
  });

  it('shows "Preparing summary..." and retries on 503, then succeeds', async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary)
      .mockRejectedValueOnce(new ApiError(503, "Service Unavailable"))
      .mockImplementationOnce(streamingSuccess("## Summary after retry"));

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    expect(
      await screen.findByText("Preparing summary...", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Summary after retry", {}, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(knowledgeService.streamArtifactSummary).toHaveBeenCalledTimes(2);
  });

  it("shows error with retry and back-to-file buttons on non-503 failure", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary).mockRejectedValue(
      new Error("Network failure"),
    );

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    expect(
      await screen.findByTestId("retry-summary-btn", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Network failure", {}, { timeout: 5000 })).toBeInTheDocument();
    const backBtns = screen.getAllByText("Back to File");
    expect(backBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("returns to raw view on Back to File", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(
      streamingSuccess("Summary text"),
    );

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    const backBtn = await screen.findByTestId("back-to-file-btn");
    await userEvent.click(backBtn);

    expect(screen.getByTestId("raw-content")).toBeInTheDocument();
  });

  it("hides the Summarise button in summary view", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.streamArtifactSummary).mockReturnValue(new Promise(() => {}));

    renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    expect(screen.queryByTestId("summarise-btn")).not.toBeInTheDocument();
  });

  it("aborts the in-flight stream when the drawer unmounts", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(knowledgeService.streamArtifactSummary).mockImplementation(
      (_projectId, _id, _handlers, signal) => {
        capturedSignal = signal;
        return new Promise<void>(() => {});
      },
    );

    const { unmount } = renderDrawer();
    const summariseBtn = await screen.findByTestId("summarise-btn");
    await userEvent.click(summariseBtn);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  describe("Markdown rendering", () => {
    it("renders .md files as markdown even with non-markdown mime types", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "# Markdown content",
        mimeType: "application/octet-stream",
        isObjectUrl: false,
      });

      renderDrawer(createArtifact({ title: "readme.md" }));

      const rawContent = await screen.findByTestId("raw-content");
      expect(rawContent.querySelector(".prose")).toBeInTheDocument();
    });

    it("renders Pull Request and Issue artifacts as markdown", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "## PR Description\n- Added new feature\n- Fixed bugs",
        mimeType: "text/plain",
        isObjectUrl: false,
      });

      renderDrawer(
        createArtifact({
          title: "PR #42: Add feature",
          artifactType: "PULL_REQUEST",
          sourceUrl: "https://github.com/org/repo/pull/42",
        }),
      );

      const rawContent = await screen.findByTestId("raw-content");
      expect(rawContent.querySelector(".prose")).toBeInTheDocument();
      expect(await screen.findByText("PR Description")).toBeInTheDocument();
    });

    it("renders Jira / GitHub issues as markdown even if artifactType is FILE", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "## Bug Report\nSteps to reproduce: ...",
        mimeType: "text/plain",
        isObjectUrl: false,
      });

      renderDrawer(
        createArtifact({
          title: "Issue #101: Crash on startup",
          artifactType: "FILE",
          sourceUrl: "https://github.com/org/repo/issues/101",
        }),
      );

      const rawContent = await screen.findByTestId("raw-content");
      expect(rawContent.querySelector(".prose")).toBeInTheDocument();
      expect(await screen.findByText("Bug Report")).toBeInTheDocument();
    });

    it("gracefully handles KaTeX math parse errors without breaking the drawer", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "Inline math $E=mc^2$ and broken block $$\n1+1=2$$text after",
        mimeType: "text/markdown",
        isObjectUrl: false,
      });

      renderDrawer(createArtifact({ title: "math.md" }));

      const rawContent = await screen.findByTestId("raw-content");
      expect(rawContent.querySelector(".prose")).toBeInTheDocument();
      expect(await screen.findByText(/Inline math/)).toBeInTheDocument();
    });

    it("highlights markdown elements and shows cited-chunk banner when highlightLines are provided", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "# Heading 1\n\nThis is paragraph one.\n\nThis is paragraph two cited.",
        mimeType: "text/markdown",
        isObjectUrl: false,
      });

      // Highlight line 5 (paragraph two)
      renderDrawer(createArtifact({ title: "docs.md" }), { highlightLines: [5] });

      const banner = await screen.findByTestId("cited-chunk-banner");
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/Showing cited chunk \(Line 5\)/)).toBeInTheDocument();

      const highlightedParagraph = screen.getByText("This is paragraph two cited.");
      expect(highlightedParagraph).toHaveAttribute("data-highlighted", "true");
      expect(highlightedParagraph).toHaveAttribute("id", "line-5");
    });

    it("allows switching between Formatted preview and Source view for markdown files", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "# Title\nSome content.",
        mimeType: "text/markdown",
        isObjectUrl: false,
      });

      renderDrawer(createArtifact({ title: "readme.md" }));

      const previewBtn = await screen.findByTestId("view-rendered-btn");
      const sourceBtn = await screen.findByTestId("view-source-btn");

      expect(previewBtn).toBeInTheDocument();
      expect(sourceBtn).toBeInTheDocument();

      // Click Source
      await userEvent.click(sourceBtn);

      const rawContent = await screen.findByTestId("raw-content");
      // Syntax highlighter creates line number spans
      expect(rawContent.querySelector(".react-syntax-highlighter-line-number")).toBeInTheDocument();

      // Switch back to Formatted
      await userEvent.click(previewBtn);
      expect(rawContent.querySelector(".prose")).toBeInTheDocument();
    });

    it("uses markdown language when switching to source mode for PR and Issue artifacts", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "## PR Description",
        mimeType: "text/plain",
        isObjectUrl: false,
      });

      renderDrawer(
        createArtifact({
          title: "PR #42: Add feature",
          artifactType: "PULL_REQUEST",
          sourceUrl: "https://github.com/org/repo/pull/42",
        }),
      );

      const sourceBtn = await screen.findByTestId("view-source-btn");
      await userEvent.click(sourceBtn);

      const rawContent = await screen.findByTestId("raw-content");
      const codeElement = rawContent.querySelector("code[class*='language-markdown']");
      expect(codeElement).toBeInTheDocument();
    });

    it("does not generate duplicate line id attributes on inline code elements", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.getArtifactContent).mockResolvedValueOnce({
        content: "Here is `inline code` inside a paragraph.",
        mimeType: "text/markdown",
        isObjectUrl: false,
      });

      renderDrawer(createArtifact({ title: "doc.md" }), { highlightLines: [1] });

      const rawContent = await screen.findByTestId("raw-content");
      const pElement = rawContent.querySelector("p");
      expect(pElement).toHaveAttribute("id", "line-1");

      const inlineCode = rawContent.querySelector("p code");
      expect(inlineCode).toBeInTheDocument();
      expect(inlineCode).not.toHaveAttribute("id");
    });

    describe("preprocessMarkdown", () => {
      it("injects a newline after a mid-line block-math close so it stays a valid `$$` fence", () => {
        expect(preprocessMarkdown("math $$E=mc^2$$ then text")).toBe("math $$E=mc^2$$\nthen text");
      });

      it("leaves an opening `$$` at the start of a line untouched", () => {
        expect(preprocessMarkdown("$$\nE=mc^2\n$$")).toBe("$$\nE=mc^2\n$$");
      });
    });
  });

  describe("Delete button", () => {
    it("is hidden when canDelete is false (even for UPLOAD artifacts)", async () => {
      renderDrawer(createArtifact({ sourceSystem: "UPLOAD" }), { canDelete: false });

      await screen.findByTestId("raw-content");
      expect(screen.queryByTestId("delete-artifact-btn")).not.toBeInTheDocument();
    });

    it("is hidden for non-UPLOAD artifacts even when canDelete is true", async () => {
      renderDrawer(createArtifact({ sourceSystem: "GITHUB" }), { canDelete: true });

      await screen.findByTestId("raw-content");
      expect(screen.queryByTestId("delete-artifact-btn")).not.toBeInTheDocument();
    });

    it("is visible for UPLOAD artifacts when canDelete is true", async () => {
      renderDrawer(createArtifact({ sourceSystem: "UPLOAD" }), { canDelete: true });

      expect(await screen.findByTestId("delete-artifact-btn")).toBeInTheDocument();
    });

    it("opens a confirmation dialog on click, then deletes on confirm", async () => {
      const { onDelete } = renderDrawer(
        createArtifact({ sourceSystem: "UPLOAD", id: "ingestion-1", sourceId: "up-1" }),
        { canDelete: true },
      );

      const deleteBtn = await screen.findByTestId("delete-artifact-btn");
      await userEvent.click(deleteBtn);

      const confirmBtn = await screen.findByTestId("confirm-delete-btn");
      await userEvent.click(confirmBtn);

      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      // Delete uses sourceId (UploadedArtifact UUID), not id (ingestion mirror UUID).
      expect(knowledgeService.deleteUpload).toHaveBeenCalledWith("proj-1", "up-1", "remover-1");
      expect(onDelete).toHaveBeenCalledWith("ingestion-1");
    });

    it("surfaces an error when sourceId is missing for an UPLOAD artifact", async () => {
      renderDrawer(createArtifact({ sourceSystem: "UPLOAD", sourceId: undefined }), {
        canDelete: true,
      });

      const deleteBtn = await screen.findByTestId("delete-artifact-btn");
      await userEvent.click(deleteBtn);

      const confirmBtn = await screen.findByTestId("confirm-delete-btn");
      await userEvent.click(confirmBtn);

      expect(
        await screen.findByText(/Couldn't resolve the uploaded artifact id for deletion/),
      ).toBeInTheDocument();
    });

    it("surfaces the error as a toast when deletion fails", async () => {
      const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
      vi.mocked(knowledgeService.deleteUpload).mockRejectedValueOnce(new Error("Network failure"));

      renderDrawer(createArtifact({ sourceSystem: "UPLOAD" }), { canDelete: true });

      const deleteBtn = await screen.findByTestId("delete-artifact-btn");
      await userEvent.click(deleteBtn);

      const confirmBtn = await screen.findByTestId("confirm-delete-btn");
      await userEvent.click(confirmBtn);

      expect(await screen.findByText("Network failure")).toBeInTheDocument();
    });
  });
});
