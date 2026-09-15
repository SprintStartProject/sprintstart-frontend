import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatProvider } from "../../../../src/context/ChatProvider";
import { ChatContext } from "../../../../src/context/ChatContext";
import { getMyChats } from "../../../../src/services/chatService";

const { project } = vi.hoisted(() => ({
  project: { id: "p1", selected: true },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "user-a" }, status: "authenticated" }),
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    selectedProjectId: project.id,
    selectedProject: project.selected ? { id: project.id, name: "Alpha" } : null,
  }),
}));

vi.mock("../../../../src/services/chatService", () => ({
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  getMyChats: vi.fn(),
  getMessages: vi.fn(),
  streamMessage: vi.fn(),
}));

/** Reports how many chats the provider holds, so the context is actually read. */
function Probe() {
  const context = useContext(ChatContext);
  return <span data-testid="chats">{context?.chats.length ?? 0}</span>;
}

describe("ChatProvider project gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.selected = true;
    vi.mocked(getMyChats).mockResolvedValue({ chats: [] });
  });

  it("loads the chats for a project the selection has been confirmed against", async () => {
    render(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );

    await waitFor(() => expect(vi.mocked(getMyChats)).toHaveBeenCalledWith("p1"));
    expect(screen.getByTestId("chats")).toBeInTheDocument();
  });

  it("sends no request while the stored selection is not in the project list yet", async () => {
    // The restored ID is non-empty before the project list arrives. Asking about it there is
    // what produced a 403 for a project the user has no membership in.
    project.selected = false;

    render(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("chats")).toBeInTheDocument());
    expect(vi.mocked(getMyChats)).not.toHaveBeenCalled();
  });
});
