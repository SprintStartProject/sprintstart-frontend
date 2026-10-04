import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { AddSourceModal } from "../../../src/features/data-ingestion/components/AddSourceModal";
import { server } from "../setup/vitest.setup";

// The tests scan the dialog rather than `baseElement`: `ToastProvider` mounts the app's
// notification list beside the modal, and an empty `ol` that every page shares is chrome
// this test has no say over.
function renderModal() {
  render(
    <ToastProvider>
      <main>
        <AddSourceModal
          projectId="project-1"
          projectName="Apollo"
          tokenNames={[]}
          canIngest
          onClose={vi.fn()}
          onConnected={vi.fn()}
        />
      </main>
    </ToastProvider>,
  );
}

describe("AddSourceModal Accessibility", () => {
  it("has no axe violations on the source-type chooser", async () => {
    renderModal();

    const dialog = await screen.findByRole("dialog", { name: "Add a source" });

    expect(await axe(dialog)).toHaveNoViolations();
  });

  it("has no axe violations on a detail screen with a missing credential", async () => {
    server.use(http.get("/api/v1/atlassian/credentials", () => HttpResponse.json([])));
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", { name: /jira/i }));
    await waitFor(() => expect(screen.getByTestId("jira-display-name")).toBeInTheDocument());

    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});
