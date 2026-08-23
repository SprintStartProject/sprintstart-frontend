import { render as testingRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OrientationEditor } from "../../../../src/features/orientation/components/OrientationEditor";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import type {
  AuthorOrientationInput,
  OrientationPacket,
} from "../../../../src/features/orientation/types";

function render(ui: ReactElement) {
  return testingRender(<ToastProvider>{ui}</ToastProvider>);
}

const packet: OrientationPacket = {
  taskId: "task-1",
  taskTitle: "Fix the stale cache header",
  summary: "What you need to change the header.",
  sections: [
    {
      step: "SET_UP",
      title: "Run it locally",
      body: "Run make dev.",
      citations: [
        { filename: "README.md", chunkId: "c1", sourceUrl: "https://example.test/README.md" },
      ],
    },
  ],
  sources: [
    { filename: "README.md", sourceUrl: "https://example.test/README.md", artifactType: "FILE" },
  ],
  assembledAt: "2026-07-21T12:00:00Z",
  origin: "AI",
};

describe("OrientationEditor", () => {
  it("seeds from an existing packet and saves the edited draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <OrientationEditor
        taskTitle="Fix the stale cache header"
        taskUrl={null}
        initial={packet}
        onSave={onSave}
        onRevert={vi.fn().mockResolvedValue(true)}
        onClose={onClose}
      />,
    );

    // The existing section is loaded for editing.
    const titleInput = screen.getByDisplayValue("Run it locally");
    await user.clear(titleInput);
    await user.type(titleInput, "Get it running");
    await user.click(screen.getByTestId("save-orientation"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = onSave.mock.calls[0][0] as AuthorOrientationInput;
    expect(input.sections[0].title).toBe("Get it running");
    // Citations survive editing and drop the chunkId the AI used.
    expect(input.sections[0].citations[0]).toEqual({
      filename: "README.md",
      sourceUrl: "https://example.test/README.md",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Orientation saved")).toBeInTheDocument();
  });

  it("lists the five fixed steps in order and needs none of them pre-added", () => {
    render(
      <OrientationEditor
        taskTitle="A task"
        taskUrl={null}
        initial={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The five steps are the scaffold, always present — there is no "add section".
    expect(screen.getAllByTestId("editor-section")).toHaveLength(5);
    expect(screen.getByText("Before you start")).toBeInTheDocument();
    expect(screen.getByText("Open the pull request")).toBeInTheDocument();
    expect(screen.queryByTestId("add-section")).not.toBeInTheDocument();
  });

  it("cannot save until a step has both a title and a body", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);

    render(
      <OrientationEditor
        taskTitle="A task"
        taskUrl={null}
        initial={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    // Nothing written yet → cannot save. The first step is open by default.
    expect(screen.getByTestId("save-orientation")).toBeDisabled();

    // A title alone leaves the step half-written, which must not be saveable.
    await user.type(screen.getByTestId("step-title-SET_UP"), "Set up");
    expect(screen.getByTestId("save-orientation")).toBeDisabled();

    await user.type(screen.getByTestId("step-body-SET_UP"), "Clone and run it.");
    expect(screen.getByTestId("save-orientation")).toBeEnabled();

    await user.click(screen.getByTestId("save-orientation"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].sections).toHaveLength(1);
    expect(onSave.mock.calls[0][0].sections[0].step).toBe("SET_UP");
  });

  it("hands the task back to the AI when reverted", async () => {
    const user = userEvent.setup();
    const onRevert = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(
      <OrientationEditor
        taskTitle="A task"
        taskUrl={null}
        initial={packet}
        onSave={vi.fn()}
        onRevert={onRevert}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByTestId("revert-orientation"));

    await waitFor(() => expect(onRevert).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Handed back to AI")).toBeInTheDocument();
  });

  it("offers no revert when there is no packet to hand back", () => {
    render(
      <OrientationEditor
        taskTitle="A task"
        taskUrl={null}
        initial={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("revert-orientation")).not.toBeInTheDocument();
  });
});
