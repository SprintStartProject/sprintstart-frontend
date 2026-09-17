import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    hasSelectedProject: project.selected,
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

function FilterProbe() {
  const context = useContext(ChatContext);
  if (!context) return null;

  return (
    <div>
      <span data-testid="filter-count">{context.activeFilterCount}</span>
      <button onClick={() => context.toggleSourceSystem("GITHUB")}>Add GitHub</button>
      <button
        onClick={() => {
          context.setFrom("2026-09-01");
          context.setTo("2026-09-10");
        }}
      >
        Set Range
      </button>
      <button onClick={context.clearFilters}>Clear</button>
    </div>
  );
}

describe("ChatProvider activeFilterCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.selected = true;
    vi.mocked(getMyChats).mockResolvedValue({ chats: [] });
  });

  it("counts a date range (both from and to set) as 1 filter", async () => {
    render(
      <ChatProvider>
        <FilterProbe />
      </ChatProvider>,
    );

    await waitFor(() => expect(vi.mocked(getMyChats)).toHaveBeenCalledWith("p1"));
    expect(screen.getByTestId("filter-count")).toHaveTextContent("0");

    // Setting a date range increments count by 1 (not 2)
    fireEvent.click(screen.getByText("Set Range"));
    expect(screen.getByTestId("filter-count")).toHaveTextContent("1");

    // Adding a source brings count to 2
    fireEvent.click(screen.getByText("Add GitHub"));
    expect(screen.getByTestId("filter-count")).toHaveTextContent("2");

    // Clearing resets count to 0
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByTestId("filter-count")).toHaveTextContent("0");
  });
});
