import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfluenceConnectStep } from "../../../../src/features/data-ingestion/components/ConfluenceConnectStep";

describe("ConfluenceConnectStep (data-ingestion)", () => {
  it("renders form fields and handles input changes", async () => {
    const user = userEvent.setup();
    const onBaseUrlChange = vi.fn();
    const onSpaceIdChange = vi.fn();
    const onEmailChange = vi.fn();
    const onApiTokenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ConfluenceConnectStep
        baseUrl=""
        spaceId=""
        email=""
        apiToken=""
        onBaseUrlChange={onBaseUrlChange}
        onSpaceIdChange={onSpaceIdChange}
        onEmailChange={onEmailChange}
        onApiTokenChange={onApiTokenChange}
        onSubmit={onSubmit}
      />,
    );

    const baseUrlInput = screen.getByLabelText(/confluence base url/i);
    const spaceIdInput = screen.getByLabelText(/space id/i);
    const emailInput = screen.getByLabelText(/account email/i);
    const tokenInput = screen.getByLabelText(/api token/i);

    expect(baseUrlInput).toBeInTheDocument();
    expect(spaceIdInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(tokenInput).toBeInTheDocument();

    await user.type(baseUrlInput, "https://test.atlassian.net");
    expect(onBaseUrlChange).toHaveBeenCalled();

    await user.type(spaceIdInput, "123456");
    expect(onSpaceIdChange).toHaveBeenCalled();

    await user.type(emailInput, "user@test.com");
    expect(onEmailChange).toHaveBeenCalled();

    await user.type(tokenInput, "token123");
    expect(onApiTokenChange).toHaveBeenCalled();
  });
});
