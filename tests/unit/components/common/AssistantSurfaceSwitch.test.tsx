import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AssistantSurfaceSwitch } from "../../../../src/components/common/AssistantSurfaceSwitch";

describe("AssistantSurfaceSwitch", () => {
  it("says which of the two assistants is on screen", () => {
    render(
      <MemoryRouter initialEntries={["/buddy"]}>
        <AssistantSurfaceSwitch current="buddy" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Buddy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "false");
  });

  it("crosses to the other one", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <Routes>
          <Route path="/chat" element={<AssistantSurfaceSwitch current="chat" />} />
          <Route path="/buddy" element={<p>the buddy page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Buddy" }));

    expect(screen.getByText("the buddy page")).toBeInTheDocument();
  });
});
