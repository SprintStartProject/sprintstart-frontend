import { CheckCircle2, CircleSlash, Clock3 } from "lucide-react";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { AccessBadge } from "./Badges";

type StatusChipProps = {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeVariant?: BadgeVariant;
  inactiveVariant: BadgeVariant;
  inactiveKind: "disabled" | "pending";
};

export function StatusChip({
  active,
  activeLabel,
  inactiveLabel,
  activeVariant = "success",
  inactiveVariant,
  inactiveKind,
}: StatusChipProps) {
  const Icon = active ? CheckCircle2 : inactiveKind === "disabled" ? CircleSlash : Clock3;

  return (
    <AccessBadge variant={active ? activeVariant : inactiveVariant} className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {active ? activeLabel : inactiveLabel}
    </AccessBadge>
  );
}
