import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AlertDialog } from "../../../../src/components/ui/AlertDialog";

describe("AlertDialog", () => {
  it("does not render when isOpen is false", () => {
    render(<AlertDialog isOpen={false} title="Hidden" onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("renders correctly when isOpen is true", () => {
    render(
      <AlertDialog
        isOpen={true}
        title="Visible Dialog"
        description="This is a test description."
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Visible Dialog")).toBeInTheDocument();
    expect(screen.getByText("This is a test description.")).toBeInTheDocument();
  });

  it("fires onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirmMock = vi.fn();
    render(
      <AlertDialog isOpen={true} title="Action" onClose={vi.fn()} onConfirm={onConfirmMock} />,
    );

    await user.click(screen.getByText("Confirm"));
    expect(onConfirmMock).toHaveBeenCalledOnce();
  });

  it("fires onClose when cancel or Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCloseMock = vi.fn();
    render(<AlertDialog isOpen={true} title="Action" onClose={onCloseMock} onConfirm={vi.fn()} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCloseMock).toHaveBeenCalledOnce();

    await user.keyboard("{Escape}");
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });

  it("shows loading state and disables buttons", () => {
    render(
      <AlertDialog
        isOpen={true}
        title="Action"
        isLoading={true}
        loadingLabel="Processing..."
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(screen.getByText("Processing...").closest("button")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });
});
