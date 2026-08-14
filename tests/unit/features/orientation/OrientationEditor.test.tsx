import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { OrientationEditor } from "../../../../src/features/orientation/components/OrientationEditor";
import type {
  AuthorOrientationInput,
  OrientationPacket,
} from "../../../../src/features/orientation/types";

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
  });

  it("cannot save until a section has a title and a body", async () => {
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

    // No sections yet → cannot save.
    expect(screen.getByTestId("save-orientation")).toBeDisabled();

    await user.click(screen.getByTestId("add-section"));
    // A section with empty title/body is still not saveable.
    expect(screen.getByTestId("save-orientation")).toBeDisabled();

    await user.type(screen.getByLabelText("Section title"), "Set up");
    await user.type(screen.getByLabelText("Section body"), "Clone and run it.");
    expect(screen.getByTestId("save-orientation")).toBeEnabled();

    await user.click(screen.getByTestId("save-orientation"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].sections).toHaveLength(1);
  });

  it("reuses the hire renderer so the preview cannot drift from what ships", async () => {
    const user = userEvent.setup();

    render(
      <OrientationEditor
        taskTitle="A task"
        taskUrl={null}
        initial={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("add-section"));
    await user.type(screen.getByLabelText("Section title"), "Set up first");
    await user.type(screen.getByLabelText("Section body"), "Clone the repo.");

    // The preview column renders the author's words through the same panel a hire sees.
    const preview = screen.getByText("What the hire will see").parentElement as HTMLElement;
    expect(await within(preview).findByText("Set up first")).toBeInTheDocument();
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
