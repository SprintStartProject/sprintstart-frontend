import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { BlueprintSubGraphEditor } from "../../../../src/features/blueprints/components/BlueprintSubGraphEditor.tsx";
import type {
  BlueprintGraphNode,
  BlueprintPhase,
  BlueprintQuestion,
  BlueprintStep,
} from "../../../../src/features/blueprints/types.ts";

const step = {
  id: "s1",
  blueprintPhaseId: "p1",
  revision: 1,
  position: 1,
  title: "Read the docs",
  description: "Start here",
  type: "DOCUMENT",
  aiAssisted: false,
  estimatedMinutes: 15,
  expectedOutcome: "Knows the layout",
  blockerIds: [],
  graphX: 0,
  graphY: 0,
  blueprintTasks: [
    {
      id: "t2",
      blueprintStepId: "s1",
      revision: 1,
      position: 2,
      title: "Second task",
      description: "later",
    },
    {
      id: "t1",
      blueprintStepId: "s1",
      revision: 1,
      position: 1,
      title: "First task",
      description: "sooner",
    },
  ],
  blueprintResources: [
    {
      id: "r1",
      blueprintStepId: "s1",
      revision: 1,
      title: "Handbook",
      description: "PDF",
      url: "u",
    },
  ],
} as unknown as BlueprintStep;

const question = {
  id: "q1",
  blueprintPhaseId: "p1",
  revision: 1,
  position: 2,
  title: "Check basics",
  type: "MULTIPLE_CHOICE",
  question: "What is a hook?",
  explanation: null,
  correctAnswer: null,
  blockerIds: ["s1"],
  graphX: 200,
  graphY: 0,
  blueprintCheckOptions: [
    { id: "o2", position: 2, label: "A class", correct: false },
    { id: "o1", position: 1, label: "A function", correct: true },
  ],
} as unknown as BlueprintQuestion;

const shortQuestion = {
  ...question,
  id: "q2",
  title: "Say it",
  type: "SHORT_TEXT",
  blueprintCheckOptions: [],
  graphX: 400,
} as unknown as BlueprintQuestion;

const phase = {
  id: "p1",
  title: "Week one",
  blueprintSteps: [step],
  blueprintCheckQuestions: [question, shortQuestion],
} as unknown as BlueprintPhase;

function graphNode(
  id: string,
  title: string,
  type: "STEP" | "QUESTION",
  x: number,
  blockerIds: string[] = [],
) {
  return { id, revision: 1, title, graphX: x, graphY: 0, blockerIds, type } as BlueprintGraphNode;
}

const nodes = [
  graphNode("s1", "Read the docs", "STEP", 0),
  graphNode("q1", "Check basics", "QUESTION", 200, ["s1"]),
  graphNode("q2", "Say it", "QUESTION", 400, ["q1"]),
];

type Props = Parameters<typeof BlueprintSubGraphEditor>[0];

function props(over: Partial<Props> = {}): Props {
  const ok = vi.fn(() => Promise.resolve());
  return {
    phase,
    nodes,
    editable: true,
    onBack: vi.fn(),
    onPositionChange: ok,
    onAddBlocker: ok,
    onRemoveBlocker: ok,
    onCreateNode: ok,
    onDeleteStep: vi.fn(() => Promise.resolve()),
    onDeleteQuestion: vi.fn(() => Promise.resolve()),
    onUpdateQuestion: vi.fn(() => Promise.resolve()),
    onAddOption: vi.fn(() => Promise.resolve()),
    onRemoveOption: vi.fn(() => Promise.resolve()),
    onUpdateStep: vi.fn(() => Promise.resolve()),
    onAddTask: vi.fn(),
    onRemoveTask: vi.fn(),
    onAddResource: vi.fn(),
    onRemoveResource: vi.fn(),
    onEditTask: vi.fn(),
    onEditResource: vi.fn(),
    onEditOption: vi.fn(),
    ...over,
  };
}

function renderEditor(over: Partial<Props> = {}) {
  const all = props(over);
  rtlRender(<BlueprintSubGraphEditor {...all} />, { wrapper: ToastProvider });
  return all;
}

/** A click on a node, as the canvas hears one: it runs on pointer events, not on `click`. */
function clickNode(id: string) {
  const element = screen.getByTestId(`graph-node-${id}`);
  fireEvent.pointerDown(element, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, pointerId: 1 });
}

async function openNode(id: string, title: string) {
  clickNode(id);
  return screen.findByRole("dialog", { name: title });
}

describe("BlueprintSubGraphEditor", () => {
  it("draws the phase and goes back to the phases", async () => {
    const user = userEvent.setup();
    const all = renderEditor();

    expect(screen.getByText("Week one")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-s1")).toHaveTextContent("Step");
    expect(screen.getByTestId("graph-node-q1")).toHaveTextContent("Knowledge check");

    await user.click(screen.getByRole("button", { name: "Back to phases" }));
    expect(all.onBack).toHaveBeenCalledTimes(1);
  });

  describe("a step", () => {
    it("opens with its stored fields and says it is saved", async () => {
      renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      expect(within(dialog).getByDisplayValue("Read the docs")).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue("Start here")).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue("15")).toBeInTheDocument();
      expect(within(dialog).getByText("Saved")).toBeInTheDocument();
      expect(
        within(dialog).queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument();
    });

    it("lists the tasks in order and the resources", async () => {
      renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      const tasks = within(dialog)
        .getAllByText(/^(First|Second) task$/)
        .map((entry) => entry.textContent);
      expect(tasks).toEqual(["First task", "Second task"]);
      expect(within(dialog).getByText("Handbook")).toBeInTheDocument();
    });

    it("offers Save and Discard once a field differs, and saves the edited fields", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      const title = within(dialog).getByDisplayValue("Read the docs");
      await user.clear(title);
      await user.type(title, "Read the handbook");
      await user.selectOptions(within(dialog).getByDisplayValue("Document"), "VIDEO");
      expect(within(dialog).queryByText("Saved")).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(all.onUpdateStep).toHaveBeenCalledTimes(1));
      expect(all.onUpdateStep).toHaveBeenCalledWith(step, {
        title: "Read the handbook",
        description: "Start here",
        type: "VIDEO",
        aiAssisted: false,
        estimatedMinutes: 15,
        expectedOutcome: "Knows the layout",
      });
      expect(await screen.findByText("Step saved")).toBeInTheDocument();
    });

    it("edits every other field too", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      await user.clear(within(dialog).getByDisplayValue("Start here"));
      await user.type(within(dialog).getByLabelText(/^Description/), "New text");
      await user.clear(within(dialog).getByDisplayValue("15"));
      await user.type(within(dialog).getByLabelText("Estimated minutes"), "30");
      await user.clear(within(dialog).getByDisplayValue("Knows the layout"));
      await user.type(within(dialog).getByLabelText("Expected outcome"), "Ready");
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(all.onUpdateStep).toHaveBeenCalled());
      expect(all.onUpdateStep).toHaveBeenCalledWith(
        step,
        expect.objectContaining({
          description: "New text",
          estimatedMinutes: 30,
          expectedOutcome: "Ready",
        }),
      );
    });

    it("shows why saving failed and keeps the fields", async () => {
      const user = userEvent.setup();
      renderEditor({ onUpdateStep: vi.fn(() => Promise.reject(new Error("Title taken"))) });
      const dialog = await openNode("s1", "Read the docs");
      await user.type(within(dialog).getByDisplayValue("Read the docs"), "!");

      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Title taken");
      expect(within(dialog).getByDisplayValue("Read the docs!")).toBeInTheDocument();
    });

    it("says so when the failure carries no message", async () => {
      const user = userEvent.setup();
      renderEditor({
        onUpdateStep: vi.fn(() => {
          const reason: unknown = "nope";
          throw reason;
        }),
      });
      const dialog = await openNode("s1", "Read the docs");
      await user.type(within(dialog).getByDisplayValue("Read the docs"), "!");

      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Step metadata could not be saved.",
      );
    });

    it("takes the edits back with Discard", async () => {
      const user = userEvent.setup();
      renderEditor();
      const dialog = await openNode("s1", "Read the docs");
      await user.type(within(dialog).getByDisplayValue("Read the docs"), "!");

      await user.click(within(dialog).getByRole("button", { name: "Discard" }));

      expect(within(dialog).getByDisplayValue("Read the docs")).toBeInTheDocument();
      expect(within(dialog).getByText("Saved")).toBeInTheDocument();
    });

    it("hands tasks and resources to the page", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      await user.click(within(dialog).getByRole("button", { name: "Add task" }));
      expect(all.onAddTask).toHaveBeenCalledWith(step);
      await user.click(within(dialog).getByRole("button", { name: "Add resource" }));
      expect(all.onAddResource).toHaveBeenCalledWith(step);

      await user.click(within(dialog).getByText("First task"));
      expect(all.onEditTask).toHaveBeenCalledWith(step.blueprintTasks[1]);
      await user.click(within(dialog).getByText("Handbook"));
      expect(all.onEditResource).toHaveBeenCalledWith(step.blueprintResources[0]);

      await user.click(within(dialog).getByRole("button", { name: "Delete task First task" }));
      expect(all.onRemoveTask).toHaveBeenCalledWith(step.blueprintTasks[1]);
      expect(all.onEditTask).toHaveBeenCalledTimes(1);
      await user.click(within(dialog).getByRole("button", { name: "Delete resource Handbook" }));
      expect(all.onRemoveResource).toHaveBeenCalledWith(step.blueprintResources[0]);
      expect(all.onEditResource).toHaveBeenCalledTimes(1);
    });

    it("opens a task from the keyboard", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      const row = within(dialog).getByText("First task").closest("[role=button]") as HTMLElement;
      row.focus();
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      await user.keyboard("a");

      expect(all.onEditTask).toHaveBeenCalledTimes(2);
    });
  });

  describe("a knowledge check", () => {
    it("opens with its fields and its options in order", async () => {
      renderEditor();
      const dialog = await openNode("q1", "Check basics");

      expect(within(dialog).getByDisplayValue("What is a hook?")).toBeInTheDocument();
      const options = within(dialog).getAllByRole("button", { name: /^Edit option / });
      expect(options.map((option) => option.getAttribute("aria-label"))).toEqual([
        "Edit option A function",
        "Edit option A class",
      ]);
      expect(within(dialog).getByText("Correct")).toBeInTheDocument();
      expect(within(dialog).getByText("Incorrect")).toBeInTheDocument();
    });

    it("saves the edited fields", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("q1", "Check basics");

      await user.type(within(dialog).getByLabelText("Explanation"), "Because");
      await user.type(within(dialog).getByLabelText("Correct answer"), "a function");
      await user.selectOptions(within(dialog).getByDisplayValue("Multiple choice"), "SHORT_TEXT");
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(all.onUpdateQuestion).toHaveBeenCalled());
      expect(all.onUpdateQuestion).toHaveBeenCalledWith(question, {
        title: "Check basics",
        type: "SHORT_TEXT",
        question: "What is a hook?",
        explanation: "Because",
        correctAnswer: "a function",
      });
      expect(await screen.findByText("Knowledge check saved")).toBeInTheDocument();
    });

    it("edits the title and the question text", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("q1", "Check basics");

      await user.type(within(dialog).getByLabelText(/^Title/), "!");
      await user.type(within(dialog).getByLabelText(/^Question(?! type)/), "?");
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(all.onUpdateQuestion).toHaveBeenCalled());
      expect(all.onUpdateQuestion).toHaveBeenCalledWith(
        question,
        expect.objectContaining({ title: "Check basics!", question: "What is a hook??" }),
      );
    });

    it("shows why saving failed, and the generic text when there is none", async () => {
      const user = userEvent.setup();
      renderEditor({
        onUpdateQuestion: vi.fn(() => {
          const reason: unknown = "nope";
          throw reason;
        }),
      });
      const dialog = await openNode("q1", "Check basics");
      await user.type(within(dialog).getByLabelText("Explanation"), "x");

      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Question metadata could not be saved.",
      );
    });

    it("adds an option with the correct flag, then closes the form", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("q1", "Check basics");

      await user.click(within(dialog).getByRole("button", { name: "Add option" }));
      await user.type(within(dialog).getByLabelText(/^Option/), "A hook is a function");
      await user.click(within(dialog).getByRole("checkbox", { name: /Correct option/ }));
      await user.click(within(dialog).getAllByRole("button", { name: "Add option" }).at(-1)!);

      await waitFor(() =>
        expect(all.onAddOption).toHaveBeenCalledWith(question, "A hook is a function", true),
      );
      await waitFor(() =>
        expect(within(dialog).queryByLabelText(/^Option/)).not.toBeInTheDocument(),
      );
    });

    it("keeps the form and shows why when adding an option fails", async () => {
      const user = userEvent.setup();
      renderEditor({ onAddOption: vi.fn(() => Promise.reject(new Error("Duplicate option"))) });
      const dialog = await openNode("q1", "Check basics");
      await user.click(within(dialog).getByRole("button", { name: "Add option" }));
      await user.type(within(dialog).getByLabelText(/^Option/), "A class");

      await user.click(within(dialog).getAllByRole("button", { name: "Add option" }).at(-1)!);

      expect(await within(dialog).findByText("Duplicate option")).toBeInTheDocument();
      expect(within(dialog).getByLabelText(/^Option/)).toHaveValue("A class");
    });

    it("cancels adding an option", async () => {
      const user = userEvent.setup();
      renderEditor();
      const dialog = await openNode("q1", "Check basics");
      await user.click(within(dialog).getByRole("button", { name: "Add option" }));

      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(within(dialog).queryByLabelText(/^Option/)).not.toBeInTheDocument();
    });

    it("hands options to the page", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("q1", "Check basics");

      await user.click(within(dialog).getByRole("button", { name: "Edit option A function" }));
      expect(all.onEditOption).toHaveBeenCalledWith(question.blueprintCheckOptions[1]);

      await user.click(within(dialog).getByRole("button", { name: "Delete option A class" }));
      expect(all.onRemoveOption).toHaveBeenCalledWith(question.blueprintCheckOptions[0]);
      expect(all.onEditOption).toHaveBeenCalledTimes(1);
    });

    it("offers no options to add to a short-text check, and says there are none", async () => {
      renderEditor();
      const dialog = await openNode("q2", "Say it");

      expect(within(dialog).queryByRole("button", { name: "Add option" })).not.toBeInTheDocument();
      expect(within(dialog).getByText("No options have been added.")).toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("asks first, deletes the step, closes the panel and says so", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      expect(confirm).toHaveTextContent('Delete step "Read the docs"?');
      expect(confirm).toHaveTextContent("Its tasks, resources and every prerequisite");
      await user.click(within(confirm).getByRole("button", { name: "Delete step" }));

      await waitFor(() => expect(all.onDeleteStep).toHaveBeenCalledWith(step));
      expect(await screen.findByText('Step "Read the docs" deleted')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Read the docs" })).not.toBeInTheDocument(),
      );
    });

    it("deletes a knowledge check", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("q1", "Check basics");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      expect(confirm).toHaveTextContent('Delete knowledge check "Check basics"?');
      expect(confirm).toHaveTextContent("Its answer options and every prerequisite");
      await user.click(within(confirm).getByRole("button", { name: "Delete knowledge check" }));

      await waitFor(() => expect(all.onDeleteQuestion).toHaveBeenCalledWith(question));
      expect(await screen.findByText('Knowledge check "Check basics" deleted')).toBeInTheDocument();
    });

    it("keeps the panel and shows why when it fails", async () => {
      const user = userEvent.setup();
      renderEditor({ onDeleteStep: vi.fn(() => Promise.reject(new Error("In use"))) });
      const dialog = await openNode("s1", "Read the docs");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Delete step" }));

      expect(await within(confirm).findByText("In use")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Read the docs" })).toBeInTheDocument();
    });

    it("says so when the failure carries no message", async () => {
      const user = userEvent.setup();
      renderEditor({
        onDeleteQuestion: vi.fn(() => {
          const reason: unknown = "nope";
          throw reason;
        }),
      });
      const dialog = await openNode("q1", "Check basics");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Delete knowledge check" }));

      expect(
        await within(confirm).findByText("The knowledge check could not be deleted."),
      ).toBeInTheDocument();
    });

    it("leaves everything alone when cancelled", async () => {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
      const confirm = await screen.findByRole("alertdialog");
      await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(all.onDeleteStep).not.toHaveBeenCalled();
    });
  });

  describe("leaving with unsaved edits", () => {
    async function dirtyStep() {
      const user = userEvent.setup();
      const all = renderEditor();
      const dialog = await openNode("s1", "Read the docs");
      await user.type(within(dialog).getByDisplayValue("Read the docs"), "!");
      return { user, all, dialog };
    }

    it("asks before the Escape key closes the panel, and keeps editing on request", async () => {
      const { user, dialog } = await dirtyStep();

      fireEvent.keyDown(document.body, { key: "Escape" });
      const ask = await screen.findByRole("alertdialog");
      expect(ask).toHaveTextContent("Discard your changes?");
      expect(ask).toHaveTextContent("This step has edits that have not been saved.");
      expect(ask).not.toHaveTextContent("moves on to the next one");
      await user.click(within(ask).getByRole("button", { name: "Keep editing" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(within(dialog).getByDisplayValue("Read the docs!")).toBeInTheDocument();
    });

    it("closes the panel without a question when nothing changed", async () => {
      renderEditor();
      await openNode("s1", "Read the docs");

      fireEvent.keyDown(document.body, { key: "Escape" });

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Read the docs" })).not.toBeInTheDocument(),
      );
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("discards the edits and closes", async () => {
      const { user } = await dirtyStep();

      fireEvent.keyDown(document.body, { key: "Escape" });
      const ask = await screen.findByRole("alertdialog");
      await user.click(within(ask).getByRole("button", { name: "Discard changes" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Read the docs" })).not.toBeInTheDocument(),
      );
      const again = await openNode("s1", "Read the docs");
      expect(within(again).getByDisplayValue("Read the docs")).toBeInTheDocument();
    });

    it("asks before moving on to a neighbour, and moves on once discarded", async () => {
      const { user, dialog } = await dirtyStep();

      const neighbours = within(dialog).getByRole("navigation", {
        name: "Steps either side of this one",
      });
      await user.click(within(neighbours).getByRole("button", { name: "Opens: Check basics" }));
      const ask = await screen.findByRole("alertdialog");
      expect(ask).toHaveTextContent("Discarding them moves on to the next one.");
      await user.click(within(ask).getByRole("button", { name: "Discard changes" }));

      expect(await screen.findByRole("dialog", { name: "Check basics" })).toBeInTheDocument();
    });

    it("moves on straight away when nothing changed", async () => {
      const user = userEvent.setup();
      renderEditor();
      const dialog = await openNode("s1", "Read the docs");

      const neighbours = within(dialog).getByRole("navigation", {
        name: "Steps either side of this one",
      });
      await user.click(within(neighbours).getByRole("button", { name: "Opens: Check basics" }));

      expect(await screen.findByRole("dialog", { name: "Check basics" })).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("asks about a knowledge check as a knowledge check", async () => {
      const user = userEvent.setup();
      renderEditor();
      const dialog = await openNode("q1", "Check basics");
      await user.type(within(dialog).getByLabelText("Explanation"), "x");

      fireEvent.keyDown(document.body, { key: "Escape" });

      expect(await screen.findByRole("alertdialog")).toHaveTextContent(
        "This knowledge check has edits that have not been saved.",
      );
    });
  });

  describe("a version that cannot be edited", () => {
    it("shows the step as text and offers a draft carrying the node", async () => {
      const user = userEvent.setup();
      const onRequestDraft = vi.fn();
      renderEditor({ editable: false, onRequestDraft });
      const dialog = await openNode("s1", "Read the docs");

      expect(within(dialog).getByText("Start here")).toBeInTheDocument();
      expect(within(dialog).getByText("15 minutes")).toBeInTheDocument();
      expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Add task" })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
      expect(
        within(dialog).getByText("This version is published, so it is read-only."),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Edit as draft" }));
      expect(onRequestDraft).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });

    it("shows the question as text", async () => {
      renderEditor({ editable: false, onRequestDraft: vi.fn() });
      const dialog = await openNode("q1", "Check basics");

      expect(within(dialog).getByText("MULTIPLE CHOICE")).toBeInTheDocument();
      expect(within(dialog).getByText("What is a hook?")).toBeInTheDocument();
      expect(within(dialog).getByText("Not specified.")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "Add option" })).not.toBeInTheDocument();
    });

    it("has no footer at all without a way to ask for a draft", async () => {
      renderEditor({ editable: false });
      const dialog = await openNode("s1", "Read the docs");

      expect(
        within(dialog).queryByRole("button", { name: "Edit as draft" }),
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByText(/read-only/)).not.toBeInTheDocument();
    });
  });

  describe("opening a node asked for by title", () => {
    it("opens it once and tells the asker", async () => {
      const onOpenedNode = vi.fn();
      renderEditor({ openNodeTitle: "Check basics", onOpenedNode });

      expect(await screen.findByRole("dialog", { name: "Check basics" })).toBeInTheDocument();
      expect(onOpenedNode).toHaveBeenCalledTimes(1);
    });

    it("does nothing for a title that is not there", async () => {
      const onOpenedNode = vi.fn();
      renderEditor({ openNodeTitle: "Nothing like it", onOpenedNode });

      await Promise.resolve();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onOpenedNode).not.toHaveBeenCalled();
    });
  });
});
