import { useState } from "react";
import { LayoutList } from "lucide-react";
import { Button, type ButtonVariant } from "../../../components/ui/Button";
import { TaskPoolBrowser } from "./TaskPoolBrowser";

type BrowseTasksButtonProps = {
  label?: string;
  variant?: ButtonVariant;
};

/**
 * Opens the task browser. Owns the dialog, so any card can offer the pool without the page having
 * to host it — and the dialog only fetches the pool while it is open.
 */
export function BrowseTasksButton({
  label = "Browse tasks",
  variant = "secondary",
}: BrowseTasksButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size="xs"
        icon={<LayoutList className="h-3.5 w-3.5" aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <TaskPoolBrowser isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
