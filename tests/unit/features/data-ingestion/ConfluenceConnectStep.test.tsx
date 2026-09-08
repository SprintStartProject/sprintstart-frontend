import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfluenceConnectStep } from "../../../../src/features/data-ingestion/components/ConfluenceConnectStep";
import type { AtlassianCredentialDto } from "../../../../src/services/sources/atlassianService";

const credentials: AtlassianCredentialDto[] = [
  { userEmail: "user@test.com", displayName: "default" },
  { userEmail: "other@test.com", displayName: "ci" },
];

describe("ConfluenceConnectStep (data-ingestion)", () => {
  it("renders form fields and handles input changes", async () => {
    const user = userEvent.setup();
    const onBaseUrlChange = vi.fn();
    const onSpaceIdChange = vi.fn();
    const onCredentialNameChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ConfluenceConnectStep
        baseUrl=""
        spaceId=""
        credentialName="default"
        credentials={credentials}
        credentialsLoaded
        credentialsLoading={false}
        credentialsError={null}
        onBaseUrlChange={onBaseUrlChange}
        onSpaceIdChange={onSpaceIdChange}
        onCredentialNameChange={onCredentialNameChange}
        onSubmit={onSubmit}
      />,
    );

    const baseUrlInput = screen.getByLabelText(/confluence base url/i);
    const spaceIdInput = screen.getByLabelText(/space id/i);

    expect(baseUrlInput).toBeInTheDocument();
    expect(spaceIdInput).toBeInTheDocument();
    expect(screen.getByLabelText("Credential")).toBeInTheDocument();

    await user.type(baseUrlInput, "https://test.atlassian.net");
    expect(onBaseUrlChange).toHaveBeenCalled();

    await user.type(spaceIdInput, "123456");
    expect(onSpaceIdChange).toHaveBeenCalled();

    await user.click(screen.getByLabelText("Credential"));
    await user.click(await screen.findByRole("option", { name: "ci - other@test.com" }));
    expect(onCredentialNameChange).toHaveBeenCalledWith("ci");
  });

  it("shows a warning when no credentials are stored", () => {
    render(
      <ConfluenceConnectStep
        baseUrl=""
        spaceId=""
        credentialName=""
        credentials={[]}
        credentialsLoaded
        credentialsLoading={false}
        credentialsError={null}
        onBaseUrlChange={vi.fn()}
        onSpaceIdChange={vi.fn()}
        onCredentialNameChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/no atlassian credentials are stored/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Credential")).toBeDisabled();
  });

  it("suppresses the missing-credential banner when asked", () => {
    render(
      <ConfluenceConnectStep
        baseUrl=""
        spaceId=""
        credentialName=""
        credentials={[]}
        credentialsLoaded
        credentialsLoading={false}
        credentialsError={null}
        onBaseUrlChange={vi.fn()}
        onSpaceIdChange={vi.fn()}
        onCredentialNameChange={vi.fn()}
        onSubmit={vi.fn()}
        suppressMissingCredentialNotice
      />,
    );

    expect(screen.queryByText(/no atlassian credentials are stored/i)).not.toBeInTheDocument();
  });
});
