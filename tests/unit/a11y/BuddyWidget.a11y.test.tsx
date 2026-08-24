import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { BuddyWidget } from "../../../src/features/buddy/components/BuddyWidget";
import { BuddyProvider } from "../../../src/features/buddy/BuddyProvider";
import { server } from "../setup/vitest.setup";

describe("BuddyWidget Accessibility", () => {
  it("has no axe violations when closed", async () => {
    const { baseElement } = render(
      // The widget navigates (it hands the conversation off to /buddy), so it needs a
      // router here for the same reason it has one in App: it is mounted inside one.
      <MemoryRouter>
        <main>
          <BuddyProvider>
            <BuddyWidget />
          </BuddyProvider>
        </main>
      </MemoryRouter>,
    );

    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations when opened", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/buddy/messages", () =>
        HttpResponse.json([
          { role: "USER", content: "hi", createdAt: "2026-07-18T00:00:00.000Z" },
          { role: "ASSISTANT", content: "hello!", createdAt: "2026-07-18T00:00:01.000Z" },
        ]),
      ),
    );

    const user = userEvent.setup();
    const { baseElement } = render(
      // The widget navigates (it hands the conversation off to /buddy), so it needs a
      // router here for the same reason it has one in App: it is mounted inside one.
      <MemoryRouter>
        <main>
          <BuddyProvider>
            <BuddyWidget />
          </BuddyProvider>
        </main>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open buddy chat" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Onboarding buddy" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("hello!")).toBeInTheDocument();
    });

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
