import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NewStarterTaskModal } from "../../../../src/features/starter-work/components/NewStarterTaskModal";

function renderModal(overrides: Partial<Parameters<typeof NewStarterTaskModal>[0]> = {}) {
  const onCreate = overrides.onCreate ?? vi.fn().mockResolvedValue(true);
  const onClose = overrides.onClose ?? vi.fn();
  render(
    <NewStarterTaskModal
      isSaving={false}
      error={null}
      onCreate={onCreate}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onCreate, onClose };
}

describe("NewStarterTaskModal", () => {
  it("cannot submit without a title", () => {
    renderModal();
    expect(screen.getByTestId("create-starter-task")).toBeDisabled();
  });

  it("creates with the title and omits blank optional fields", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.click(screen.getByTestId("create-starter-task"));

    expect(onCreate).toHaveBeenCalledWith(
      {
        title: "Add dark mode",
        summary: undefined,
        sourceUrl: undefined,
        competencyKeys: undefined,
        // "Any role" is the default, and it is sent as absent rather than as a sentinel.
      },
      { top: 0, left: 0, width: 0, height: 0 },
    );
  });

  it("parses comma- or space-separated competency keys into a list", async () => {
    const user = userEvent.setup();
    const { onCreate } = renderModal();

    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.type(screen.getByLabelText(/Prerequisite competencies/i), "react,  typescript  css");
    await user.click(screen.getByTestId("create-starter-task"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ competencyKeys: ["react", "typescript", "css"] }),
      { top: 0, left: 0, width: 0, height: 0 },
    );
  });

  it("closes after a successful create", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ onCreate: vi.fn().mockResolvedValue(true) });

    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.click(screen.getByTestId("create-starter-task"));

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when the create fails", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ onCreate: vi.fn().mockResolvedValue(false) });

    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.click(screen.getByTestId("create-starter-task"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
