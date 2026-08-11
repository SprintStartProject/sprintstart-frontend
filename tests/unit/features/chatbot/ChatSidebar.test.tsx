import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ChatSidebar } from "../../../../src/features/chatbot/components/ChatSidebar";
import type { Chat } from "../../../../src/features/chatbot/types";

describe("ChatSidebar", () => {
  const mockChats: Chat[] = [
    {
      id: "chat1",
      userId: "user1",
      projectId: "project-1",
      createdAt: new Date().toISOString(),
      title: "First chat",
    },
    {
      id: "chat2",
      userId: "user1",
      projectId: "project-1",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      title: "",
    },
  ];

  it("renders chats grouped by date bucket with relative timestamps", () => {
    render(
      <MemoryRouter>
        <ChatSidebar chats={mockChats} setSidebarOpen={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("New Chat")).toBeInTheDocument();
    // "Today" / "Yesterday" each appear twice: once as the group header and
    // once as the relative timestamp on the chat item.
    expect(screen.getAllByText("Today")).toHaveLength(2);
    expect(screen.getAllByText("Yesterday")).toHaveLength(2);
    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("calls setSidebarOpen when a chat is clicked", async () => {
    const user = userEvent.setup();
    const setSidebarOpen = vi.fn();
    render(
      <MemoryRouter>
        <ChatSidebar chats={mockChats} setSidebarOpen={setSidebarOpen} />
      </MemoryRouter>,
    );

    await user.click(screen.getByText("First chat"));
    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it("filters chats by the search query", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatSidebar chats={mockChats} setSidebarOpen={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Search conversations"), "First");

    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("shows a no-match empty state when the query matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ChatSidebar chats={mockChats} setSidebarOpen={vi.fn()} />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Search conversations"), "zzz-nope");

    expect(screen.getByText(/No chats match/u)).toBeInTheDocument();
  });
});
