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

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("settings-notion-add-name"), " wiki ");
  await user.type(screen.getByTestId("settings-notion-add-token"), " secret ");
  await user.click(screen.getByTestId("settings-notion-add-submit"));
}

describe("NotionCredentialAddForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addNotionCredential).mockResolvedValue(undefined);
  });

  it("has no email field and explains that pages must be shared", () => {
    render(<NotionCredentialAddForm onClose={vi.fn()} onSaved={vi.fn(async () => {})} />);

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/share with the integration in Notion/i)).toBeInTheDocument();
  });

  it("posts the trimmed name and token, then reports the credential and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSaved = vi.fn(async () => {});
    render(<NotionCredentialAddForm onClose={onClose} onSaved={onSaved} />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(addNotionCredential).toHaveBeenCalledWith({ name: "wiki", token: "secret" }),
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "wiki" }));
    expect(toast.success).toHaveBeenCalledWith("Notion credential added");
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    [401, /rejected this token/i],
    [409, /already exists/i],
    [502, /could not be reached/i],
  ])("shows a readable message and stays open on %i", async (status, message) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(addNotionCredential).mockRejectedValue(new ApiError(status, "raw"));
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
