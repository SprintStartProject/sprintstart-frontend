import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ChatSidebar } from "../../../src/features/chatbot/components/ChatSidebar";
import type { Chat } from "../../../src/features/chatbot/types";

describe("ChatSidebar Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const chats: Chat[] = [
      {
        id: "1",
        title: "Test Chat",
        userId: "user1",
        projectId: "project-1",
        createdAt: "2026-07-04T00:00:00.000Z",
      },
    ];
    const setSidebarOpen = vi.fn();
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
        </main>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
