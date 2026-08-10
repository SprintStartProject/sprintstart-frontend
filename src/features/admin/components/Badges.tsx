import { Badge, type BadgeProps } from "../../../components/ui/Badge";
import { getPermissionGroupVariant, getSourceStatusVariant } from "../data";

export type { BadgeVariant } from "../../../components/ui/Badge";

export function AccessBadge(props: BadgeProps) {
  return <Badge {...props} />;
}

type PermissionGroupBadgeProps = {
  permissionGroup: string;
};

export function PermissionGroupBadge({ permissionGroup }: PermissionGroupBadgeProps) {
  return (
    <div className="flex min-w-0 items-center">
      <AccessBadge variant={getPermissionGroupVariant(permissionGroup)}>
        {permissionGroup}
      </AccessBadge>
    </div>
  );
}

type SourceStatusBadgeProps = {
  status: string;
};

export function SourceStatusBadge({ status }: SourceStatusBadgeProps) {
  return <AccessBadge variant={getSourceStatusVariant(status)}>{status}</AccessBadge>;
}
