import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UploadArtifactModal } from "../../../../../src/features/knowledge-base/components/UploadArtifactModal";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    uploadDocuments: vi.fn(),
  },
}));

describe("UploadArtifactModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function makeFile(name: string): File {
    return new File(["dummy"], name, { type: "text/markdown" });
  }

  it("renders nothing when isOpen is false", () => {
    render(<UploadArtifactModal isOpen={false} onClose={() => {}} projectId="proj-1" />);

    expect(screen.queryByTestId("upload-modal")).not.toBeInTheDocument();
  });

  it("renders the modal content when isOpen is true", () => {
    render(<UploadArtifactModal isOpen={true} onClose={() => {}} projectId="proj-1" />);

    expect(screen.getByTestId("upload-modal")).toBeInTheDocument();
    expect(screen.getByText("Upload Artifacts")).toBeInTheDocument();
    // Scoped to the dialog: `Modal` also renders a backdrop button with the
    // same label, so an unscoped query matches two elements.
    expect(
      within(screen.getByTestId("upload-modal")).getByLabelText("Close upload modal"),
    ).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<UploadArtifactModal isOpen={true} onClose={onClose} projectId="proj-1" />);

    await userEvent.click(
      within(screen.getByTestId("upload-modal")).getByLabelText("Close upload modal"),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("surfaces a success batch result and fires onUploadSuccess", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.uploadDocuments).mockResolvedValue([
      { filename: "a.md", status: "success" },
      { filename: "b.md", status: "success" },
    ]);
    const onUploadSuccess = vi.fn();

    render(
      <UploadArtifactModal
        isOpen={true}
        onClose={() => {}}
        projectId="proj-1"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const input = screen.getByTestId("file-input");
    await userEvent.upload(input, makeFile("a.md"));

    await waitFor(() => {
      expect(screen.getByTestId("upload-batch-result")).toBeInTheDocument();
    });

    expect(screen.getByText(/2 ingested, 0 failed/)).toBeInTheDocument();
    expect(onUploadSuccess).toHaveBeenCalledOnce();
  });

  it("surfaces per-file errors when some uploads fail and does not fire onUploadSuccess", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    // uploadDocuments returns the mapped status ('error', not the backend's 'failed').
    vi.mocked(knowledgeService.uploadDocuments).mockResolvedValue([
      { filename: "a.md", status: "success" },
      { filename: "b.md", status: "error", error: "Invalid content" },
    ]);
    const onUploadSuccess = vi.fn();

    render(
      <UploadArtifactModal
        isOpen={true}
        onClose={() => {}}
        projectId="proj-1"
        onUploadSuccess={onUploadSuccess}
      />,
    );

    const input = screen.getByTestId("file-input");
    await userEvent.upload(input, makeFile("a.md"));

    await waitFor(() => {
      expect(screen.getByTestId("upload-batch-result")).toBeInTheDocument();
    });

    expect(screen.getByText(/1 ingested, 1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/b.md: Invalid content/)).toBeInTheDocument();
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  it("shows a network error when uploadDocuments throws", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.uploadDocuments).mockRejectedValue(new Error("Network down"));

    render(<UploadArtifactModal isOpen={true} onClose={() => {}} projectId="proj-1" />);

    const input = screen.getByTestId("file-input");
    await userEvent.upload(input, makeFile("a.md"));

    await waitFor(() => {
      expect(screen.getByTestId("upload-batch-result")).toBeInTheDocument();
    });

    expect(screen.getByText(/Upload failed due to a network or server error/)).toBeInTheDocument();
  });

  it("auto-closes after a successful batch", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.uploadDocuments).mockResolvedValue([
      { filename: "a.md", status: "success" },
    ]);
    const onClose = vi.fn();

    render(<UploadArtifactModal isOpen={true} onClose={onClose} projectId="proj-1" />);

    const input = screen.getByTestId("file-input");
    await userEvent.upload(input, makeFile("a.md"));

    await waitFor(() => {
      expect(screen.getByTestId("upload-batch-result")).toBeInTheDocument();
    });

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
