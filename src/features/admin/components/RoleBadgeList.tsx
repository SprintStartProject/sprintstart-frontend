import type { BadgeVariant } from "./Badges";
import { AccessBadge } from "./Badges";

type RoleBadgeListProps = {
  roles: string[];
  variant?: BadgeVariant;
};

export function RoleBadgeList({ roles, variant = "neutral" }: RoleBadgeListProps) {
  if (roles.length === 0) {
    return <span className="text-sm text-app-text-muted">No roles</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <AccessBadge key={role} variant={variant}>
          {role}
        </AccessBadge>
      ))}
    </div>
  );
}
