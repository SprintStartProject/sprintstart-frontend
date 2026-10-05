import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StepNotes } from "../../../../src/features/board/components/StepNotes";
import {
  readCardOrigins,
  writeCardOrigins,
} from "../../../../src/features/board/layout/cardOrigins";
import { boardService } from "../../../../src/services/boardService";

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: "p1" }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../../../../src/context/useToast", () => ({ useToast: () => toast }));

function note(id: string, text: string) {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text },
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("your notes under a step", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("lists what was kept from this step, and only that", async () => {
    vi.spyOn(boardService, "fetchBoard").mockResolvedValue({
      boardId: "b1",
      projectId: "p1",
      cards: [note("a", "SSH key\nadd it to the agent first"), note("b", "Unrelated")],
    } as never);
    writeCardOrigins("p1", { a: { url: "/onboarding?step=s1&open=1", label: "Set up SSH" } });

    render(wrap(<StepNotes stepId="s1" stepTitle="Set up SSH" />));

    // Folded, it only says how many there are.
    const toggle = await screen.findByRole("button", { name: /your notes · 1/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("SSH key")).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText("SSH key")).toBeInTheDocument();
    expect(screen.getByText(/add it to the agent first/)).toBeInTheDocument();
    expect(screen.queryByText("Unrelated")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /on your board/i })).toHaveAttribute(
      "href",
      "/board?step=s1",
    );
  });

  it("keeps a new note on the board, tied to the step", async () => {
    vi.spyOn(boardService, "fetchBoard").mockResolvedValue({
      boardId: "b1",
      projectId: "p1",
      cards: [],
    });
    const addCard = vi.spyOn(boardService, "addCard").mockResolvedValue({ id: "n1" } as never);

    render(wrap(<StepNotes stepId="s1" stepTitle="Set up SSH" />));

    await userEvent.click(screen.getByRole("button", { name: /your notes/i }));
    await userEvent.type(screen.getByLabelText(/a note for yourself/i), "Ask Sam for VPN access");
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));

    await waitFor(() =>
      expect(addCard).toHaveBeenCalledWith("p1", { kind: "NOTE", text: "Ask Sam for VPN access" }),
    );
    expect(readCardOrigins("p1").n1).toEqual({
      url: "/onboarding?step=s1&open=1",
      label: "Set up SSH",
    });
    expect(screen.getByLabelText(/a note for yourself/i)).toHaveValue("");
  });
});
