import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArtifactDeletion } from "../../../../../src/features/knowledge-base/hooks/useArtifactDeletion";
import type { DrawerAction } from "../../../../../src/features/knowledge-base/drawerState";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";
import { knowledgeService } from "../../../../../src/services/knowledgeService";

interface Hoisted {
  auth: { profile: { id: string } | null };
  toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

const { auth, toast } = vi.hoisted((): Hoisted => ({
  auth: { profile: { id: "remover-1" } },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: { deleteUpload: vi.fn() },
}));
vi.mock("../../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: auth.profile }),
}));
vi.mock("../../../../../src/context/useToast", () => ({ useToast: () => toast }));

const deleteUpload = vi.mocked(knowledgeService.deleteUpload);

function artifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "ingestion-1",
    title: "upload.md",
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

function setup(subject: Artifact | null = artifact()) {
  const dispatch = vi.fn<(action: DrawerAction) => void>();
  const onDelete = vi.fn();
  const { result } = renderHook(() =>
    useArtifactDeletion({ artifact: subject, projectId: "proj-1", dispatch, onDelete }),
  );
  const types = () => dispatch.mock.calls.map(([action]) => action.type);
  return { run: result.current, dispatch, onDelete, types };
}

describe("useArtifactDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.profile = { id: "remover-1" };
    deleteUpload.mockResolvedValue(undefined);
  });

  it("deletes the upload by its source id, as the signed-in user", async () => {
    const { run } = setup();

    await run();

    expect(deleteUpload).toHaveBeenCalledWith("proj-1", "upload-1", "remover-1");
  });

  it("then closes the confirmation, hands the ingestion id back and announces it", async () => {
    const { run, onDelete, types } = setup();

    await run();

    expect(types()).toEqual(["deleteStart", "deleteSuccess", "closeDeleteConfirm"]);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("ingestion-1");
    expect(toast.success).toHaveBeenCalledWith("Artifact deleted");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the confirmation open and toasts the reason when the request fails", async () => {
    deleteUpload.mockRejectedValue(new Error("Network failure"));
    const { run, onDelete, types } = setup();

    await run();

    expect(types()).toEqual(["deleteStart", "deleteFailed"]);
    expect(onDelete).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Network failure");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a failure without one", async () => {
    deleteUpload.mockRejectedValue("boom");
    const { run } = setup();

    await run();

    expect(toast.error).toHaveBeenCalledWith("Couldn't delete the artifact.");
  });

  it("refuses without a signed-in user", async () => {
    auth.profile = null;
    const { run, dispatch } = setup();

    await run();

    expect(toast.error).toHaveBeenCalledWith("Could not resolve the authenticated user id.");
    expect(deleteUpload).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("refuses an artifact without an upload id", async () => {
    const { run, dispatch } = setup(artifact({ sourceId: "" }));

    await run();

    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't resolve the uploaded artifact id for deletion.",
    );
    expect(deleteUpload).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing without an artifact", async () => {
    const { run, dispatch } = setup(null);

    await run();

    expect(deleteUpload).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
