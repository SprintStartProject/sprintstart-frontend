import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../setup/vitest.setup";
import { ToastProvider } from "../../../../src/context/ToastProvider";
import { ConfluenceConnectStep } from "../../../../src/features/connectors/components/ConfluenceConnectStep";

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

function atlassianCredentialsHandler(names: string[], email = "user@example.com") {
  return http.get("/api/v1/atlassian/credentials", () =>
    HttpResponse.json(names.map((displayName) => ({ userEmail: email, displayName }))),
  );
}

describe("ConfluenceConnectStep (connectors)", () => {
  it("submits form and calls onSaved when API succeeds", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    server.use(
      atlassianCredentialsHandler(["default"]),
      http.post("/api/v1/confluence/projects/proj-1/connections", async ({ request }) => {
        expect(await request.json()).toMatchObject({ credentialName: "default" });

        return HttpResponse.json({
          id: "conn-1",
          projectId: "proj-1",
          baseUrl: "https://example.atlassian.net/wiki",
          spaceId: "123456",
          spaceKey: "SP",
          spaceName: "Sprint Planning",
          credentialName: "default",
          pageAllowlist: [],
          pageDenylist: [],
          credentialsConfigured: true,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          version: 1,
          sourceEnabled: true,
        });
      }),
    );

    render(<ConfluenceConnectStep projectId="proj-1" onSaved={onSaved} onClose={onClose} />);

    // The single stored credential is adopted automatically once it loads.
    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));

    await user.type(screen.getByLabelText(/confluence base url/i), "https://example.atlassian.net");
    await user.type(screen.getByLabelText(/space id/i), "123456");

    const connectButton = screen.getByRole("button", { name: /^connect space$/i });
    expect(connectButton).not.toBeDisabled();

    await user.click(connectButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("disables submit and the picker when no credentials are stored", async () => {
    render(<ConfluenceConnectStep projectId="proj-1" onSaved={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText("Credential")).toBeDisabled());
    expect(screen.getByRole("button", { name: /^connect space$/i })).toBeDisabled();
  });

  it("shows a dedicated message when the picked credential no longer exists", async () => {
    const user = userEvent.setup();

    server.use(
      atlassianCredentialsHandler(["default"]),
      http.post("/api/v1/confluence/projects/proj-1/connections", () =>
        HttpResponse.json({ message: "credential not found" }, { status: 404 }),
      ),
    );

    render(<ConfluenceConnectStep projectId="proj-1" onSaved={vi.fn()} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText("Credential")).toHaveTextContent("default"));
    await user.type(screen.getByLabelText(/confluence base url/i), "https://example.atlassian.net");
    await user.type(screen.getByLabelText(/space id/i), "123456");
    await user.click(screen.getByRole("button", { name: /^connect space$/i }));

    expect(await screen.findByText(/credential no longer exists/i)).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<ConfluenceConnectStep projectId="proj-1" onSaved={onSaved} onClose={onClose} />);

    const cancelButton = screen.getByRole("button", { name: /^cancel$/i });
    await user.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
