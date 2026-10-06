import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotionCredentialAddForm } from "../../../../../../src/features/settings/components/notion/NotionCredentialAddForm.tsx";
import { ApiError } from "../../../../../../src/services/apiClient";

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock("../../../../../../src/context/useToast", () => ({
  useToast: () => toast,
}));

vi.mock("../../../../../../src/services/sources/notionService", () => ({
  addNotionCredential: vi.fn(),
}));

import { addNotionCredential } from "../../../../../../src/services/sources/notionService";

const savedCredential = {
  name: "wiki",
  workspaceId: "ws-1",
  workspaceName: "Acme Workspace",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("settings-notion-add-name"), " wiki ");
  await user.type(screen.getByTestId("settings-notion-add-token"), " secret ");
  await user.click(screen.getByTestId("settings-notion-add-submit"));
}

describe("NotionCredentialAddForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addNotionCredential).mockResolvedValue(savedCredential);
  });

  it("has no email field and explains that every visible page is indexed", () => {
    render(<NotionCredentialAddForm onClose={vi.fn()} onSaved={vi.fn(async () => {})} />);

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/every page the token can see/i)).toBeInTheDocument();
  });

  it("posts the trimmed name and token, then hands the returned credential up and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn(async () => {});
    render(<NotionCredentialAddForm onClose={onClose} onSaved={onSaved} />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(addNotionCredential).toHaveBeenCalledWith({ name: "wiki", token: "secret" }),
    );
    // The DTO from the backend is passed on as is, so the workspace name is known right away.
    expect(onSaved).toHaveBeenCalledWith(savedCredential);
    expect(toast.success).toHaveBeenCalledWith("Notion credential added");
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    [422, "Notion rejected the supplied token.", /rejected the supplied token/i],
    [409, "raw", /already exists/i],
    [502, "raw", /could not be reached/i],
  ])("shows a readable message and stays open on %i", async (status, serverMessage, message) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(addNotionCredential).mockRejectedValue(new ApiError(status, serverMessage));
    render(<NotionCredentialAddForm onClose={onClose} onSaved={vi.fn(async () => {})} />);

    await fillAndSubmit(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(message)));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("warns but still closes when the follow-up refresh fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <NotionCredentialAddForm
        onClose={onClose}
        onSaved={vi.fn(() => Promise.reject(new Error("offline")))}
      />,
    );

    await fillAndSubmit(user);

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});
