import { ShieldCheck } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { adminUserService, type AdminUser } from "../../../services/adminUserService";
import type { DashboardWidgetSize } from "../layout/types";
import { WidgetBar } from "./WidgetBar";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

const NAMED_UNASSIGNED_COUNT = 3;

/**
 * The permission groups, in descending authority.
 *
 * Matched against the *labels* `adminUserService` produces — "Admin", "HR", "Project
 * Manager", "User" — and not against the `PermissionGroup` enum. The service maps the
 * backend's codes to display text before the widget ever sees them, so comparing to the
 * codes put every account into "other".
 *
 * Spelled out rather than derived from the data, so an account carrying something
 * unexpected lands in "other" instead of silently inventing a segment nobody chose a colour
 * for.
 */
const PERMISSION_GROUPS: readonly { label: string; plural: string; className: string }[] = [
  { label: "Admin", plural: "admins", className: "bg-app-danger-solid" },
  { label: "HR", plural: "HR", className: "bg-app-warning-solid" },
  { label: "Project Manager", plural: "project managers", className: "bg-app-brand" },
  { label: "User", plural: "members", className: "bg-app-success-solid" },
];

function displayName(user: AdminUser): string {
  return `${user.firstName} ${user.lastName}`.trim() || user.username;
}

function metricsFor(users: readonly AdminUser[]): WidgetMetric[] {
  const active = users.filter((user) => user.enabled).length;
  const unassigned = users.filter((user) => user.projectIds.length === 0).length;
  const disabled = users.length - active;

  return [
    { label: "Accounts", value: users.length, hint: `${active} can sign in` },
    {
      label: "Not in a project",
      value: unassigned,
      needsAttention: unassigned > 0,
      // An account with no project has no onboarding path to generate from, so this is
      // usually somebody who was created and then forgotten rather than a deliberate state.
      hint: unassigned > 0 ? "nothing to onboard into" : "everybody is assigned",
    },
    {
      label: "Disabled",
      value: disabled,
      needsAttention: disabled > 0,
      hint: disabled > 0 ? "cannot sign in" : "everybody can sign in",
    },
  ];
}

/**
 * Everybody with an account: how many, what they may do, and who is not in a project.
 *
 * The organization-level counterpart to the team card — that one is about the selected
 * project's members, this one about the user base access management is responsible for.
 *
 * At half a row it adds the permission spread, which is the figure an admin is actually
 * accountable for: four admins in an eight-person organization is a finding, and no count of
 * "people" would ever have shown it.
 */
export function UserOverviewWidget({ size }: { size: DashboardWidgetSize }) {
  const { data, loading, error } = useFetch(() => adminUserService.getUsers(), []);

  const users = data ?? [];
  const metrics = metricsFor(users);

  const unassigned = users.filter((user) => user.projectIds.length === 0);
  const namedUnassigned = unassigned.slice(0, NAMED_UNASSIGNED_COUNT);
  const hiddenUnassigned = unassigned.length - namedUnassigned.length;

  const knownGroups = new Set(PERMISSION_GROUPS.map((entry) => entry.label));

  const permissionSegments = [
    ...PERMISSION_GROUPS.map((entry) => ({
      label: entry.plural,
      className: entry.className,
      value: users.filter((user) => user.permissionGroup === entry.label).length,
    })),
    {
      label: "other",
      className: "bg-app-border",
      value: users.filter((user) => !knownGroups.has(user.permissionGroup)).length,
    },
  ];

  return (
    <WidgetShell
      icon={ShieldCheck}
      title="User accounts"
      actionLabel="Open access management"
      to="/admin"
      isLoading={loading}
      errorMessage={error || !data ? "Could not load the account overview." : null}
    >
      {size === "small" ? (
        <WidgetMetrics icon={ShieldCheck} metrics={metrics} />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2">
          <WidgetMetrics icon={ShieldCheck} metrics={metrics.slice(0, 2)} />

          <div className="flex flex-col justify-center gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Permission groups
              </p>
              <WidgetBar segments={permissionSegments} />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
                Not in a project
              </p>

              {namedUnassigned.length === 0 ? (
                <p className="text-xs text-app-text-muted">Everybody is assigned.</p>
              ) : (
                <ul className="space-y-1">
                  {namedUnassigned.map((user) => (
                    <li key={user.id} className="truncate text-xs text-app-text-muted">
                      <span className="font-medium text-app-text">{displayName(user)}</span>{" "}
                      {user.permissionGroup}
                    </li>
                  ))}

                  {hiddenUnassigned > 0 && (
                    <li className="text-xs text-app-text-muted">and {hiddenUnassigned} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
