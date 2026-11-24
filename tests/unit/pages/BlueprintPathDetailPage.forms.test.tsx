import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPageMocks, service, toast } from "./support/blueprintPathMocks.ts";
import { PROJECT_SCOPE, renderPage, richPath, servePath } from "./support/blueprintPathPage.tsx";

vi.mock("../../../src/context/useAuth.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return { useAuth: () => ({ profile: { permissionGroup: session.permissionGroup } }) };
});
vi.mock("../../../src/features/projects/useProjectContext.ts", async () => {
  const { session } = await import("./support/blueprintPathMocks.ts");
  return {
    useProjectContext: () => ({
      selectedProjectId: session.selectedProjectId,
      isLoading: session.isProjectLoading,
    }),
  };
});
vi.mock("../../../src/context/useToast.ts", async () => {
  const { toast } = await import("./support/blueprintPathMocks.ts");
  return { useToast: () => toast };
});
vi.mock("../../../src/services/blueprintService.ts", async () => {
  const { service } = await import("./support/blueprintPathMocks.ts");
  return { blueprintService: service };
});

type User = ReturnType<typeof userEvent.setup>;

async function openForm(user: User, trigger: string) {
  const [first] = await screen.findAllByRole("button", { name: trigger });
  await user.click(first);
  return screen.findByRole("dialog");
}

/** A field by its label, which carries a hidden asterisk when the field is required. */
function field(dialog: HTMLElement, label: string) {
  const escaped = label.replace(/[()]/g, String.raw`\$&`);
  return within(dialog).getByLabelText(new RegExp(`^${escaped}\\*?$`));
}

async function fill(user: User, dialog: HTMLElement, label: string, value: string) {
  const input = field(dialog, label);
  await user.clear(input);
  await user.type(input, value);
}

async function submit(user: User, dialog: HTMLElement, name: string) {
  await user.click(within(dialog).getByRole("button", { name }));
}

describe("BlueprintPathDetailPage adding content", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  it("adds a fixed phase at the end of the path", async () => {
    const user = userEvent.setup();
    service.createPhase.mockResolvedValue({ id: "phase-3" });
    renderPage();

    const dialog = await openForm(user, "Add phase");
    expect(within(dialog).getByText("Add phase", { selector: "h2" })).toBeInTheDocument();
    await fill(user, dialog, "Title", "Ship it");
    await submit(user, dialog, "Add phase");

    await waitFor(() =>
      expect(service.createPhase).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1", {
        position: 2,
        title: "Ship it",
        description: null,
        aiPrompt: null,
        type: "FIXED",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("adds an AI-enhanced phase with its prompt and description", async () => {
    const user = userEvent.setup();
    service.createPhase.mockResolvedValue({ id: "phase-3" });
    renderPage();

    const dialog = await openForm(user, "Add phase");
    expect(within(dialog).queryByLabelText(/^AI prompt/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("switch", { name: "Use AI prompt for this phase" }));
    expect(within(dialog).getByText("AI-enhanced blueprint")).toBeInTheDocument();
    await fill(user, dialog, "Title", "Domain");
    await fill(user, dialog, "Description", "Learn it");
    await fill(user, dialog, "AI prompt", "Be brief");
    await submit(user, dialog, "Add phase");

    await waitFor(() =>
      expect(service.createPhase).toHaveBeenCalledWith(PROJECT_SCOPE, "path-1", {
        position: 2,
        title: "Domain",
        description: "Learn it",
        aiPrompt: "Be brief",
        type: "AI_ENHANCED",
      }),
    );
  });

  it("switches an AI phase back to fixed and hides the prompt", async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openForm(user, "Add phase");
    const toggle = within(dialog).getByRole("switch", { name: "Use AI prompt for this phase" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(within(dialog).getByText("Fixed blueprint")).toBeInTheDocument();
  });

  it("adds a step to the phase", async () => {
    const user = userEvent.setup();
    service.createStep.mockResolvedValue({ id: "step-3", revision: 0 });
    renderPage();

    const dialog = await openForm(user, "Add step");
    await fill(user, dialog, "Title", "Deploy");
    await fill(user, dialog, "Description", "Ship to staging");
    await user.selectOptions(field(dialog, "Step type"), "VIDEO");
    await fill(user, dialog, "Estimated minutes", "20");
    await fill(user, dialog, "Expected outcome", "Live");
    await submit(user, dialog, "Add step");

    await waitFor(() =>
      expect(service.createStep).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", {
        position: 2,
        title: "Deploy",
        description: "Ship to staging",
        type: "VIDEO",
        estimatedMinutes: 20,
        expectedOutcome: "Live",
      }),
    );
  });

  it("adds a task to a step", async () => {
    const user = userEvent.setup();
    service.createTask.mockResolvedValue({ id: "task-2" });
    renderPage();

    const dialog = await openForm(user, "Add task");
    await fill(user, dialog, "Title", "Pull main");
    await fill(user, dialog, "Description", "Daily");
    await submit(user, dialog, "Add task");

    await waitFor(() =>
      expect(service.createTask).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        position: 2,
        title: "Pull main",
        description: "Daily",
      }),
    );
  });

  it("adds a resource to a step", async () => {
    const user = userEvent.setup();
    service.createResource.mockResolvedValue({ id: "res-2" });
    renderPage();

    const dialog = await openForm(user, "Add resource");
    await fill(user, dialog, "Title", "Docs");
    await fill(user, dialog, "Description", "Read");
    await fill(user, dialog, "URL", "https://example.com/docs");
    await submit(user, dialog, "Add resource");

    await waitFor(() =>
      expect(service.createResource).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        title: "Docs",
        description: "Read",
        url: "https://example.com/docs",
      }),
    );
  });

  it("adds a question named by its node title", async () => {
    const user = userEvent.setup();
    service.createQuestion.mockResolvedValue({ id: "q-3", revision: 0 });
    renderPage();

    const dialog = await openForm(user, "Add question");
    await fill(user, dialog, "Node title", "Branching");
    await fill(user, dialog, "Question", "Why branch?");
    await user.selectOptions(field(dialog, "Question type"), "SHORT_TEXT");
    await fill(user, dialog, "Explanation", "Isolation");
    await fill(user, dialog, "Correct answer (for free text)", "isolation");
    await submit(user, dialog, "Add question");

    await waitFor(() =>
      expect(service.createQuestion).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", {
        position: 2,
        title: "Branching",
        type: "SHORT_TEXT",
        question: "Why branch?",
        explanation: "Isolation",
        correctAnswer: "isolation",
      }),
    );
  });

  it("names a question after its wording when no node title is given", async () => {
    const user = userEvent.setup();
    service.createQuestion.mockResolvedValue({ id: "q-3", revision: 0 });
    renderPage();

    const dialog = await openForm(user, "Add question");
    await user.type(field(dialog, "Node title"), " ");
    await fill(user, dialog, "Question", "Why branch?");
    await submit(user, dialog, "Add question");

    await waitFor(() => expect(service.createQuestion).toHaveBeenCalled());
    const input = service.createQuestion.mock.calls[0][2] as Record<string, unknown>;
    expect(input).toMatchObject({
      question: "Why branch?",
      type: "MULTIPLE_CHOICE",
      explanation: null,
      correctAnswer: null,
    });
  });

  it("adds an option, correct or not", async () => {
    const user = userEvent.setup();
    service.createOption.mockResolvedValue({ id: "opt-3" });
    renderPage();

    const dialog = await openForm(user, "Add option");
    await fill(user, dialog, "Label", "Also a VCS");
    await user.click(within(dialog).getByRole("checkbox", { name: /Correct answer/ }));
    await submit(user, dialog, "Add option");

    await waitFor(() =>
      expect(service.createOption).toHaveBeenCalledWith(PROJECT_SCOPE, "q-1", {
        position: 2,
        label: "Also a VCS",
        correct: true,
      }),
    );
  });

  it("clears what was typed when the next item is opened", async () => {
    const user = userEvent.setup();
    renderPage();

    const first = await openForm(user, "Add task");
    await fill(user, first, "Title", "Leftover");
    await user.click(within(first).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const second = await openForm(user, "Add task");
    expect(field(second, "Title")).toHaveValue("");
  });

  it("shows why an item could not be saved, inside the form", async () => {
    const user = userEvent.setup();
    service.createTask.mockRejectedValue(new Error("Revision moved on"));
    renderPage();

    const dialog = await openForm(user, "Add task");
    await fill(user, dialog, "Title", "Pull main");
    await fill(user, dialog, "Description", "Daily");
    await submit(user, dialog, "Add task");

    expect(await within(dialog).findByText("Revision moved on")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("falls back to a generic message naming the kind", async () => {
    const user = userEvent.setup();
    service.createTask.mockRejectedValue("nope");
    renderPage();

    const dialog = await openForm(user, "Add task");
    await fill(user, dialog, "Title", "Pull main");
    await fill(user, dialog, "Description", "Daily");
    await submit(user, dialog, "Add task");

    expect(await within(dialog).findByText("The task could not be saved.")).toBeInTheDocument();
  });

  it("offers a draft instead of a form on a published version", async () => {
    const user = userEvent.setup();
    servePath(richPath("ACTIVE"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add step" }));

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
    expect(screen.queryByText("Add step", { selector: "h2" })).not.toBeInTheDocument();
  });
});

describe("BlueprintPathDetailPage editing content", () => {
  beforeEach(() => {
    resetPageMocks();
    servePath(richPath());
  });

  it("edits a phase, seeded with its own values", async () => {
    const user = userEvent.setup();
    service.updatePhase.mockResolvedValue({});
    renderPage();

    const dialog = await openForm(user, "Edit phase Get set up");
    expect(within(dialog).getByText("Edit phase", { selector: "h2" })).toBeInTheDocument();
    expect(field(dialog, "Title")).toHaveValue("Get set up");
    expect(field(dialog, "Description")).toHaveValue("Tooling and access");
    await fill(user, dialog, "Title", "Get started");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updatePhase).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-1", {
        revision: 1,
        position: 0,
        title: "Get started",
        description: "Tooling and access",
        type: "FIXED",
        aiPrompt: null,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("phase saved"));
  });

  it("edits an AI phase's prompt", async () => {
    const user = userEvent.setup();
    service.updatePhase.mockResolvedValue({});
    renderPage();

    const dialog = await openForm(user, "Edit phase Learn the domain");
    expect(field(dialog, "AI prompt")).toHaveValue("Tailor it to the hire's role");
    await fill(user, dialog, "AI prompt", "Keep it short");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updatePhase).toHaveBeenCalledWith(PROJECT_SCOPE, "phase-2", {
        revision: 9,
        position: 1,
        title: "Learn the domain",
        description: null,
        type: "AI_ENHANCED",
        aiPrompt: "Keep it short",
      }),
    );
  });

  it("edits a step", async () => {
    const user = userEvent.setup();
    service.updateStep.mockResolvedValue({});
    renderPage();

    const dialog = await openForm(user, "Edit step");
    expect(field(dialog, "Step type")).toHaveValue("DOCUMENT");
    expect(field(dialog, "Estimated minutes")).toHaveValue(15);
    await fill(user, dialog, "Estimated minutes", "45");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updateStep).toHaveBeenCalledWith(PROJECT_SCOPE, "step-1", {
        revision: 2,
        position: 0,
        title: "Clone the repo",
        description: "Get the code",
        type: "DOCUMENT",
        estimatedMinutes: 45,
        expectedOutcome: "Repo on disk",
        aiAssisted: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("step saved"));
  });

  it("edits a question, keeping its node title and wording apart", async () => {
    const user = userEvent.setup();
    service.updateQuestion.mockResolvedValue({});
    renderPage();

    const dialog = await openForm(user, "Edit");
    expect(field(dialog, "Node title")).toHaveValue("Q node");
    expect(field(dialog, "Question")).toHaveValue("What is git?");
    expect(field(dialog, "Explanation")).toHaveValue("A VCS");
    await fill(user, dialog, "Question", "What is Git?");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updateQuestion).toHaveBeenCalledWith(PROJECT_SCOPE, "q-1", {
        revision: 5,
        position: 0,
        title: "Q node",
        type: "MULTIPLE_CHOICE",
        question: "What is Git?",
        explanation: "A VCS",
        correctAnswer: null,
      }),
    );
  });

  it("edits a task by clicking it", async () => {
    const user = userEvent.setup();
    service.updateTask.mockResolvedValue({});
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^• Run git clone$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(field(dialog, "Title")).toHaveValue("Run git clone");
    await fill(user, dialog, "Description", "Use HTTPS");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updateTask).toHaveBeenCalledWith(PROJECT_SCOPE, "task-1", {
        revision: 3,
        position: 0,
        title: "Run git clone",
        description: "Use HTTPS",
      }),
    );
  });

  it("opens a task from the keyboard", async () => {
    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole("button", { name: /^• Run git clone$/ });
    row.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("opens a resource from the space bar and edits its link", async () => {
    const user = userEvent.setup();
    service.updateResource.mockResolvedValue({});
    renderPage();

    const row = await screen.findByRole("button", { name: /^Git handbook$/ });
    row.focus();
    await user.keyboard(" ");
    const dialog = await screen.findByRole("dialog");
    expect(field(dialog, "URL")).toHaveValue("https://example.com/git");
    await fill(user, dialog, "URL", "https://example.com/new");
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updateResource).toHaveBeenCalledWith(PROJECT_SCOPE, "res-1", {
        revision: 4,
        title: "Git handbook",
        description: "Read it",
        url: "https://example.com/new",
      }),
    );
  });

  it("edits an option's label and whether it is correct", async () => {
    const user = userEvent.setup();
    service.updateOption.mockResolvedValue({});
    renderPage();

    await user.click(await screen.findByRole("button", { name: /^A fruit$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(field(dialog, "Label")).toHaveValue("A fruit");
    expect(within(dialog).getByRole("checkbox", { name: /Correct answer/ })).not.toBeChecked();
    await user.click(within(dialog).getByRole("checkbox", { name: /Correct answer/ }));
    await submit(user, dialog, "Save changes");

    await waitFor(() =>
      expect(service.updateOption).toHaveBeenCalledWith(PROJECT_SCOPE, "opt-2", {
        revision: 7,
        position: 1,
        label: "A fruit",
        correct: true,
      }),
    );
  });

  it("opens an option from the keyboard with a correct answer already ticked", async () => {
    const user = userEvent.setup();
    renderPage();

    const row = await screen.findByRole("button", { name: /^A VCS$/ });
    row.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("checkbox", { name: /Correct answer/ })).toBeChecked();
  });

  it("offers a draft instead of an edit form on a published version", async () => {
    const user = userEvent.setup();
    servePath(richPath("ACTIVE"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Edit phase Get set up" }));

    expect(await screen.findByText("This version is published")).toBeInTheDocument();
  });

  it("reports a failed save inside the form and keeps it open", async () => {
    const user = userEvent.setup();
    service.updatePhase.mockRejectedValue(new Error("Conflict"));
    renderPage();

    const dialog = await openForm(user, "Edit phase Get set up");
    await submit(user, dialog, "Save changes");

    expect(await within(dialog).findByText("Conflict")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("closes the form without saving when cancelled", async () => {
    const user = userEvent.setup();
    renderPage();

    const dialog = await openForm(user, "Edit phase Get set up");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(service.updatePhase).not.toHaveBeenCalled();
  });
});
