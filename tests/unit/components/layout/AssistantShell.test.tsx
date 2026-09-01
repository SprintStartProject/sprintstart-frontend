import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AssistantShell } from "../../../../src/components/layout/AssistantShell";
import { BuddyProvider } from "../../../../src/features/buddy/BuddyProvider";

function renderShell(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      {/* The header carries the buddy's "New chat", which reads the one shared conversation. */}
      <BuddyProvider>
        <Routes>
          <Route element={<AssistantShell />}>
            <Route path="/chat" element={<p>the chat surface</p>} />
            <Route path="/chat/:id" element={<p>the chat surface</p>} />
            <Route path="/buddy" element={<p>the buddy surface</p>} />
          </Route>
        </Routes>
      </BuddyProvider>
    </MemoryRouter>,
  );
}

describe("AssistantShell", () => {
  it("gives both halves one header and says which one is open", () => {
    renderShell("/buddy");

    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buddy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("the buddy surface")).toBeInTheDocument();
  });

  it("keeps the header while the panel underneath changes", async () => {
    const user = userEvent.setup();
    renderShell("/chat");

    const header = screen.getByRole("heading", { name: "AI Assistant" });
    expect(screen.getByText("the chat surface")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Buddy" }));

    expect(await screen.findByText("the buddy surface")).toBeInTheDocument();
    // The same node, not a re-rendered copy: this is what the layout route buys, and it is
    // what lets the panel below animate rather than the whole page being replaced.
    expect(screen.getByRole("heading", { name: "AI Assistant" })).toBe(header);
  });

  it("stays on the chat when the chat is a particular conversation", () => {
    renderShell("/chat/abc");

    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "true");
  });

  it("crosses on a two-finger swipe, and stops at the end", async () => {
    renderShell("/chat");

    const panel = screen.getByText("the chat surface").parentElement!;

    // Rightwards past the threshold: on to the next surface.
    fireEvent.wheel(panel, { deltaX: 60, deltaY: 0 });
    expect(await screen.findByText("the buddy surface")).toBeInTheDocument();

    // ...and no further. Wrapping back round to the chat would read as the page having
    // jumped somewhere rather than as having reached the end.
    fireEvent.wheel(panel, { deltaX: 60, deltaY: 0 });
    expect(screen.getByText("the buddy surface")).toBeInTheDocument();
  });

  it("leaves a vertical scroll alone", () => {
    renderShell("/chat");

    fireEvent.wheel(screen.getByText("the chat surface").parentElement!, {
      deltaX: 4,
      deltaY: 80,
    });

    expect(screen.getByText("the chat surface")).toBeInTheDocument();
  });
});
