import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { BitbucketRepositoryDiscovery } from "../../../src/features/data-ingestion/components/BitbucketRepositoryDiscovery";
import { server } from "../setup/vitest.setup";

const credentials = [{ displayName: "default", userEmail: "me@corp.com" }];

function renderDiscovery(
  overrides: Partial<Parameters<typeof BitbucketRepositoryDiscovery>[0]> = {},
) {
  return render(
    <BitbucketRepositoryDiscovery
      credentials={credentials}
      credentialsLoaded
      credentialsLoading={false}
      credentialsError={null}
      credentialName="default"
      onCredentialNameChange={vi.fn()}
      projectId="project-1"
      onSelectionChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe("BitbucketRepositoryDiscovery Accessibility", () => {
  it("has no violations before discovery", async () => {
    const { container } = renderDiscovery();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations without stored credentials", async () => {
    const { container } = renderDiscovery({ credentials: [], credentialName: "" });

    expect(await screen.findByText(/No Atlassian credentials are stored/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations with discovered repositories", async () => {
    server.use(
      http.get("/api/v1/bitbucket/discover/workspace/:workspace", () =>
        HttpResponse.json({
          repositories: [
            {
              workspace: "acme",
              slug: "widgets",
              name: "Widgets",
              isPrivate: true,
              url: "https://bitbucket.org/acme/widgets",
              alreadyConnected: false,
              enabled: null,
            },
            {
              workspace: "acme",
              slug: "gadgets",
              name: "gadgets",
              isPrivate: false,
              url: "https://bitbucket.org/acme/gadgets",
              alreadyConnected: true,
              enabled: false,
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    const { container } = renderDiscovery();

    await user.type(screen.getByLabelText("Workspace or bitbucket.org URL"), "acme");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await screen.findByText("Widgets (widgets)");

    expect(await axe(container)).toHaveNoViolations();
  });
});
