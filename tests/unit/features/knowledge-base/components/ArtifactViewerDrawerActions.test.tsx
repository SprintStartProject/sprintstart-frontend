import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ArtifactViewerDrawer } from "../../../../../src/features/knowledge-base/components/ArtifactViewerDrawer";
import { ApiError } from "../../../../../src/services/apiClient";
import type {
  Artifact,
  SummaryStreamHandlers,
} from "../../../../../src/features/knowledge-base/types";

interface AuthHolder {
  auth: { profile: { id: string } | null };
}

const { auth } = vi.hoisted((): AuthHolder => ({ auth: { profile: { id: "remover-1" } } }));

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactContent: vi.fn(),
    streamArtifactSummary: vi.fn(),
    deleteUpload: vi.fn(),
  },
}));

vi.mock("../../../../../src/hooks/useAskAi", () => ({
  useAskAi: () => vi.fn(() => true),
}));

vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: auth.profile }),
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
        <div data-testid="panel-title">{title}</div>
        <div data-testid="panel-actions">{actions}</div>
        {children}
      </div>
    ) : null,
}));

const FILE_CONTENT = [
  "# Test content",
  "",
  "A paragraph long enough that summarising it is a sensible thing to ask for.",
  "",
  "## Section",
  "",
  "- a bullet",
  "- another bullet",
].join("\n");

function artifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "ingestion-1",
    title: "README.md",
    artifactType: "FILE",
    sourceSystem: "UPLOAD",
    sourceId: "upload-1",
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2026-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: "hash",
    ingestionRunId: null,
    ...overrides,
  };
}

async function knowledge() {
  return (await import("../../../../../src/services/knowledgeService")).knowledgeService;
}

function renderDrawer(subject: Artifact = artifact(), canDelete = true) {
  const onDelete = vi.fn();
  const view = render(
    <ArtifactViewerDrawer
      artifact={subject}
      onClose={() => {}}
      projectId="proj-1"
      canDelete={canDelete}
      onDelete={onDelete}
    />,
    { wrapper: ToastProvider },
  );
  return { onDelete, ...view };
}

/** A summary stream that delivers the given text in one token and finishes. */
function summaryOf(text: string) {
  return (_projectId: string, _artifactId: string, handlers: SummaryStreamHandlers) => {
    handlers.onToken(text);
    handlers.onDone();
    return Promise.resolve();
  };
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ArtifactViewerDrawer actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    auth.profile = { id: "remover-1" };
    const service = await knowledge();
    vi.mocked(service.getArtifactContent).mockResolvedValue({
      content: FILE_CONTENT,
      mimeType: "text/markdown",
      isObjectUrl: false,
    });
    vi.mocked(service.deleteUpload).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deleting an upload", () => {
    async function openConfirmation() {
      fireEvent.click(await screen.findByTestId("delete-artifact-btn"));
      return screen.findByTestId("confirm-delete-btn");
    }

    it("announces the deletion, hands the id back and closes the confirmation", async () => {
      const { onDelete } = renderDrawer();

      fireEvent.click(await openConfirmation());

      expect(await screen.findByText("Artifact deleted")).toBeInTheDocument();
      const service = await knowledge();
      expect(service.deleteUpload).toHaveBeenCalledWith("proj-1", "upload-1", "remover-1");
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith("ingestion-1");
      await waitFor(() =>
        expect(screen.queryByTestId("confirm-delete-btn")).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("delete-artifact-btn")).not.toBeDisabled();
    });

    it("shows a busy confirmation and locks every delete control while the request runs", async () => {
      const pending = deferred();
      const service = await knowledge();
      vi.mocked(service.deleteUpload).mockReturnValueOnce(pending.promise);
      renderDrawer();

      fireEvent.click(await openConfirmation());

      const confirm = await screen.findByText("Deleting...");
      expect(confirm.closest("button")).toBeDisabled();
      expect(screen.getByTestId("cancel-delete-btn")).toBeDisabled();
      expect(screen.getByTestId("delete-artifact-btn")).toBeDisabled();

      act(() => pending.resolve());
      await waitFor(() => expect(screen.queryByText("Deleting...")).not.toBeInTheDocument());
    });

    it("keeps the confirmation open and usable again after a failed request", async () => {
      const service = await knowledge();
      vi.mocked(service.deleteUpload).mockRejectedValueOnce(new Error("Network failure"));
      const { onDelete } = renderDrawer();

      fireEvent.click(await openConfirmation());

      expect(await screen.findByText("Network failure")).toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
      const confirm = screen.getByTestId("confirm-delete-btn");
      expect(confirm).not.toBeDisabled();
      expect(confirm).toHaveTextContent("Delete");
      expect(screen.getByTestId("cancel-delete-btn")).not.toBeDisabled();
      expect(screen.queryByText("Artifact deleted")).not.toBeInTheDocument();
    });

    it("falls back to a generic message when the failure carries no message", async () => {
      const service = await knowledge();
      vi.mocked(service.deleteUpload).mockRejectedValueOnce("boom");
      renderDrawer();

      fireEvent.click(await openConfirmation());

      expect(await screen.findByText("Couldn't delete the artifact.")).toBeInTheDocument();
    });

    it("refuses to delete when the signed-in user cannot be resolved", async () => {
      auth.profile = null;
      renderDrawer();

      fireEvent.click(await openConfirmation());

      expect(
        await screen.findByText("Could not resolve the authenticated user id."),
      ).toBeInTheDocument();
      expect((await knowledge()).deleteUpload).not.toHaveBeenCalled();
    });

    it("refuses to delete when the upload id is missing", async () => {
      renderDrawer(artifact({ sourceId: "" }));

      fireEvent.click(await openConfirmation());

      expect(
        await screen.findByText("Couldn't resolve the uploaded artifact id for deletion."),
      ).toBeInTheDocument();
      expect((await knowledge()).deleteUpload).not.toHaveBeenCalled();
    });

    it("closes the confirmation without deleting when cancelled", async () => {
      renderDrawer();
      await openConfirmation();

      fireEvent.click(screen.getByTestId("cancel-delete-btn"));

      await waitFor(() =>
        expect(screen.queryByTestId("confirm-delete-btn")).not.toBeInTheDocument(),
      );
      expect((await knowledge()).deleteUpload).not.toHaveBeenCalled();
    });
  });

  describe("summarising", () => {
    async function startSummary() {
      const button = await screen.findByTestId("summarise-btn");
      await waitFor(() => expect(button).not.toBeDisabled());
      fireEvent.click(button);
    }

    async function streamUsing(
      implementation: (handlers: SummaryStreamHandlers, signal?: AbortSignal) => Promise<void>,
    ) {
      const service = await knowledge();
      vi.mocked(service.streamArtifactSummary).mockImplementation(
        (_projectId, _artifactId, handlers, signal) => implementation(handlers, signal),
      );
      return vi.mocked(service.streamArtifactSummary);
    }

    it("streams the summary for the open artifact in its project", async () => {
      const stream = await streamUsing((handlers) => summaryOf("The gist.")("", "", handlers));
      renderDrawer();

      await startSummary();

      expect(await screen.findByText("The gist.")).toBeInTheDocument();
      expect(stream).toHaveBeenCalledTimes(1);
      expect(stream).toHaveBeenCalledWith(
        "proj-1",
        "ingestion-1",
        expect.any(Object),
        expect.any(AbortSignal),
      );
    });

    it("shows a generic waiting message until the first token arrives", async () => {
      await streamUsing(() => new Promise<void>(() => {}));
      renderDrawer();

      await startSummary();

      expect(await screen.findByText("Generating summary...")).toBeInTheDocument();
      expect(screen.queryByText("Preparing summary...")).not.toBeInTheDocument();
    });

    it("shows the stage the backend reports while waiting", async () => {
      await streamUsing((handlers) => {
        handlers.onStage?.("retrieve", "Reading the file...");
        return new Promise<void>(() => {});
      });
      renderDrawer();

      await startSummary();

      expect(await screen.findByText("Reading the file...")).toBeInTheDocument();
      expect(screen.queryByText("Generating summary...")).not.toBeInTheDocument();
    });

    it("clears the waiting message once the stream is done", async () => {
      await streamUsing((handlers) => summaryOf("Done already.")("", "", handlers));
      renderDrawer();

      await startSummary();

      await screen.findByText("Done already.");
      expect(screen.queryByText("Generating summary...")).not.toBeInTheDocument();
      expect(screen.queryByTestId("retry-summary-btn")).not.toBeInTheDocument();
    });

    it("shows the failure message with a retry that tries again", async () => {
      const stream = await streamUsing(() => Promise.reject(new Error("The model is overloaded")));
      renderDrawer();

      await startSummary();
      expect(await screen.findByText("The model is overloaded")).toBeInTheDocument();
      expect(stream).toHaveBeenCalledTimes(1);

      stream.mockImplementation(summaryOf("Second time lucky."));
      fireEvent.click(screen.getByTestId("retry-summary-btn"));

      expect(await screen.findByText("Second time lucky.")).toBeInTheDocument();
      expect(screen.queryByText("The model is overloaded")).not.toBeInTheDocument();
      expect(stream).toHaveBeenCalledTimes(2);
    });

    it("uses a generic message when the failure is not an error object", async () => {
      const service = await knowledge();
      vi.mocked(service.streamArtifactSummary).mockRejectedValue("nope");
      renderDrawer();

      await startSummary();

      expect(await screen.findByText("Failed to summarize")).toBeInTheDocument();
    });

    it("goes back to the file from a failed summary", async () => {
      await streamUsing(() => Promise.reject(new Error("Broken")));
      renderDrawer();
      await startSummary();
      await screen.findByText("Broken");

      const backButtons = screen.getAllByRole("button", { name: /back to file/i });
      fireEvent.click(backButtons[backButtons.length - 1]);

      await waitFor(() => expect(screen.queryByTestId("summary-content")).not.toBeInTheDocument());
      expect(screen.queryByTestId("retry-summary-btn")).not.toBeInTheDocument();
    });

    it("stays silent when the stream is aborted", async () => {
      const aborted = new Error("The user aborted a request.");
      aborted.name = "AbortError";
      const stream = await streamUsing(() => Promise.reject(aborted));
      renderDrawer();

      await startSummary();
      await waitFor(() => expect(stream).toHaveBeenCalledTimes(1));

      expect(screen.queryByTestId("retry-summary-btn")).not.toBeInTheDocument();
      expect(screen.queryByText("The user aborted a request.")).not.toBeInTheDocument();
    });

    describe("while the artifact is still being indexed", () => {
      const indexing = () => new ApiError(503, "Service Unavailable");

      /** Loads the drawer on real timers, then freezes the clock and starts the summary. */
      async function startSummaryOnFakeClock() {
        const view = renderDrawer();
        const button = await screen.findByTestId("summarise-btn");
        await waitFor(() => expect(button).not.toBeDisabled());
        vi.useFakeTimers();
        fireEvent.click(button);
        await flush();
        return view;
      }

      const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
      const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

      it("shows a preparing message and retries after 2s, 4s, 8s, 16s and then 30s", async () => {
        const stream = await streamUsing(() => Promise.reject(indexing()));
        await startSummaryOnFakeClock();
        expect(stream).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Preparing summary...")).toBeInTheDocument();
        expect(screen.queryByTestId("retry-summary-btn")).not.toBeInTheDocument();

        let calls = 1;
        for (const wait of [2000, 4000, 8000, 16000, 30000, 30000]) {
          await advance(wait - 1);
          expect(stream).toHaveBeenCalledTimes(calls);
          await advance(1);
          calls += 1;
          expect(stream).toHaveBeenCalledTimes(calls);
        }
      });

      it("ends on the summary once the artifact has been indexed", async () => {
        const service = await knowledge();
        vi.mocked(service.streamArtifactSummary)
          .mockRejectedValueOnce(indexing())
          .mockImplementationOnce(summaryOf("Ready now."));
        await startSummaryOnFakeClock();
        expect(screen.getByText("Preparing summary...")).toBeInTheDocument();

        await advance(2000);

        expect(screen.getByText("Ready now.")).toBeInTheDocument();
        expect(screen.queryByText("Preparing summary...")).not.toBeInTheDocument();
        await advance(60000);
        expect(service.streamArtifactSummary).toHaveBeenCalledTimes(2);
      });

      it("stops waiting when the drawer unmounts", async () => {
        const stream = await streamUsing(() => Promise.reject(indexing()));
        const { unmount } = await startSummaryOnFakeClock();
        expect(screen.getByText("Preparing summary...")).toBeInTheDocument();

        unmount();
        await advance(120000);

        expect(stream).toHaveBeenCalledTimes(1);
      });

      it("drops a pending retry when a newer summary is requested", async () => {
        const service = await knowledge();
        vi.mocked(service.streamArtifactSummary)
          .mockRejectedValueOnce(indexing())
          .mockImplementation(summaryOf("Newer summary."));
        await startSummaryOnFakeClock();
        expect(screen.getByText("Preparing summary...")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("back-to-file-btn"));
        fireEvent.click(screen.getByTestId("summarise-btn"));
        await flush();
        expect(screen.getByText("Newer summary.")).toBeInTheDocument();
        await advance(60000);

        expect(service.streamArtifactSummary).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("markdown view switch", () => {
    it("marks the active view and swaps the mark when the other one is picked", async () => {
      renderDrawer(artifact({ title: "readme.md" }), false);

      const rendered = await screen.findByTestId("view-rendered-btn");
      const source = screen.getByTestId("view-source-btn");
      expect(rendered.className).toContain("shadow-xs");
      expect(source.className).not.toContain("shadow-xs");
      expect(source.className).toContain("text-app-text-muted");

      fireEvent.click(source);

      expect(source.className).toContain("shadow-xs");
      expect(rendered.className).not.toContain("shadow-xs");
      expect(rendered.className).toContain("text-app-text-muted");

      fireEvent.click(rendered);

      expect(rendered.className).toContain("shadow-xs");
      expect(source.className).not.toContain("shadow-xs");
    });

    it("offers no view switch for a file that is not markdown", async () => {
      const service = await knowledge();
      vi.mocked(service.getArtifactContent).mockResolvedValue({
        content: "const a = 1;",
        mimeType: "text/plain",
        isObjectUrl: false,
      });
      renderDrawer(artifact({ title: "app.ts" }), false);

      await screen.findByTestId("raw-content");

      expect(screen.queryByTestId("view-rendered-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("view-source-btn")).not.toBeInTheDocument();
    });
  });
});
