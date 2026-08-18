import { UserRound } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { adminUserService, type AdminUser } from "../../../services/adminUserService";
import { WidgetMetrics, type WidgetMetric } from "./WidgetMetrics";
import { WidgetShell } from "./WidgetShell";

/**
 * Everybody with an account, as three figures.
 *
 * The organization-level counterpart to the team card: that one is about the selected
 * project's members, this one about the whole user base, which is what access management is
 * responsible for.
 *
 * A disabled account is flagged rather than merely counted — it is the figure that usually
 * means somebody left and the account outlived them.
 */
function summarize(users: readonly AdminUser[]): WidgetMetric[] {
  const active = users.filter((user) => user.enabled).length;
  const onboarding = users.filter((user) => !user.hasCompletedOnboarding).length;
  const disabled = users.length - active;

  return [
    { label: "People", value: users.length, hint: `${active} with an active account` },
    {
      label: "Still onboarding",
      value: onboarding,
      hint: onboarding === 1 ? "1 has not finished yet" : "have not finished yet",
    },
    {
      label: "Disabled accounts",
      value: disabled,
      needsAttention: disabled > 0,
      hint: disabled > 0 ? "cannot sign in" : "everybody can sign in",
    },
  ];
}

export function UserOverviewWidget() {
  const { data, loading, error } = useFetch(() => adminUserService.getUsers(), []);

  return (
    <WidgetShell
      icon={UserRound}
      title="People"
      actionLabel="Open access management"
      to="/admin"
      isLoading={loading}
      errorMessage={error || !data ? "Could not load the people overview." : null}
    >
      <WidgetMetrics icon={UserRound} metrics={summarize(data ?? [])} />
    </WidgetShell>
  );
}
