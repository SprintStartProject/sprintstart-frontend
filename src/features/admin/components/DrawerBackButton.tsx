import { ArrowLeft } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { DrawerBackLink } from "../types";

/**
 * "Back to …" for a drawer that was opened from another one (a user's project,
 * a project's member). The drawers replace each other rather than stack, so
 * without this the way back would be closing everything and finding the
 * starting point again.
 */
export function DrawerBackButton({ back }: { back: DrawerBackLink }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={back.onBack}
      icon={<ArrowLeft className="h-4 w-4" />}
      className="max-w-56"
    >
      <span className="truncate">{back.label}</span>
    </Button>
  );
}
