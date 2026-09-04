import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlagToPmButton } from "../../../../../src/features/knowledge-request/components/FlagToPmButton";
import { knowledgeRequestService } from "../../../../../src/services/knowledgeRequestService";
import * as useProjectContextModule from "../../../../../src/features/projects/useProjectContext";
import { createProjectContextValue } from "../../../setup/projectContext";

vi.mock("../../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { escalate: vi.fn() },
}));

vi.mock("../../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: vi.fn(),
}));

function mockProject(selectedProjectId: string | null) {
  vi.mocked(useProjectContextModule.useProjectContext).mockReturnValue(
    createProjectContextValue({ selectedProjectId: selectedProjectId ?? undefined }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProject("proj1");
});

describe("FlagToPmButton", () => {
  it("offers nothing to a hire who is on no project — there is no PM to route to", () => {
    mockProject(null);
    render(<FlagToPmButton />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts as the quiet trigger link, not a form", () => {
    render(<FlagToPmButton />);

    expect(screen.getByRole("button", { name: /flag it to your pm/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("opens with the question prefilled from the conversation", async () => {
    const user = userEvent.setup();
    render(<FlagToPmButton defaultQuestion="How do I get staging credentials?" />);

    await user.click(screen.getByRole("button", { name: /flag it to your pm/i }));

    expect(screen.getByLabelText(/send this question to your pm/i)).toHaveValue(
      "How do I get staging credentials?",
    );
  });

  it("sends the trimmed question to the service and shows the sent chip", async () => {
    const user = userEvent.setup();
    vi.mocked(knowledgeRequestService.escalate).mockResolvedValue({
      id: "r1",
      projectId: "proj1",
      hireId: "h1",
      question: "q",
      status: "OPEN",
      createdAt: "2026-08-22T09:00:00Z",
      answeredAt: null,
      answer: null,
    });
    render(<FlagToPmButton />);

    await user.click(screen.getByRole("button", { name: /flag it to your pm/i }));
    await user.type(
      screen.getByLabelText(/send this question to your pm/i),
      "  Who owns deploys?  ",
    );
    await user.click(screen.getByRole("button", { name: /send to pm/i }));

    expect(knowledgeRequestService.escalate).toHaveBeenCalledWith("proj1", "Who owns deploys?");
    await waitFor(() => expect(screen.getByText(/flagged to your pm/i)).toBeInTheDocument());
    // The form is gone once the flag has been sent.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the form open with an error line when the send fails", async () => {
    const user = userEvent.setup();
    vi.mocked(knowledgeRequestService.escalate).mockRejectedValue(new Error("network"));
    render(<FlagToPmButton defaultQuestion="Who reviews infra PRs?" />);

    await user.click(screen.getByRole("button", { name: /flag it to your pm/i }));
    await user.click(screen.getByRole("button", { name: /send to pm/i }));

    expect(await screen.findByText(/couldn't send that/i)).toBeInTheDocument();
    // The draft survives so the hire can retry without retyping.
    expect(screen.getByLabelText(/send this question to your pm/i)).toHaveValue(
      "Who reviews infra PRs?",
    );
  });

  it("recovers to idle after an error, then sends successfully on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(knowledgeRequestService.escalate)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        id: "r1",
        projectId: "proj1",
        hireId: "h1",
        question: "q",
        status: "OPEN",
        createdAt: "2026-08-22T09:00:00Z",
        answeredAt: null,
        answer: null,
      });
    render(<FlagToPmButton defaultQuestion="Who reviews infra PRs?" />);

    await user.click(screen.getByRole("button", { name: /flag it to your pm/i }));
    await user.click(screen.getByRole("button", { name: /send to pm/i }));
    expect(await screen.findByText(/couldn't send that/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /send to pm/i }));
    await waitFor(() => expect(screen.getByText(/flagged to your pm/i)).toBeInTheDocument());
  });

  it("cancel returns to the quiet trigger instead of staying open", async () => {
    const user = userEvent.setup();
    render(<FlagToPmButton />);

    await user.click(screen.getByRole("button", { name: /flag it to your pm/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /flag it to your pm/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
