import { AlertTriangle, CheckCircle2, Database, History, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import type { SourceHealth, SourceHealthState } from "../data";

const HEALTH_PRESENTATION: Record<SourceHealthState, { variant: BadgeVariant; icon: LucideIcon }> =
  {
    none: { variant: "neutral", icon: Database },
    healthy: { variant: "success", icon: CheckCircle2 },
    syncing: { variant: "brand", icon: RefreshCw },
    stale: { variant: "neutral", icon: History },
    attention: { variant: "warning", icon: AlertTriangle },
  };

/**
 * A project's source health as one chip. The icon and the text carry the state
 * together with the colour, so it reads the same without telling hues apart.
 */
export function SourceHealthChip({ health }: { health: SourceHealth }) {
  const { variant, icon: Icon } = HEALTH_PRESENTATION[health.state];

  return (
    <Badge variant={variant} size="sm" className="py-1">
      <Icon className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
      {health.label}
    </Badge>
  );
}
