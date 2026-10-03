import { DrawerCard } from "../../../admin/components/DrawerCard.tsx";
import { InfoLinkRow, InfoRow } from "../../components/InfoRows.tsx";
import { jiraInstanceOf } from "../../sourceDetails.ts";
import type { DetailsSectionProps } from "../types.ts";

/** The instance's identity and the credential it is ingested with, in the details panel. */
export function JiraDetailsSection({ source, enabledRow }: DetailsSectionProps) {
  const instance = jiraInstanceOf(source);

  if (!instance) return null;

  return (
    <DrawerCard label="Instance" icon={source.icon} index={1} className="mt-4 sm:mt-5">
      <dl className="-my-1">
        <InfoRow label="Display name" value={instance.displayName} />
        <InfoLinkRow label="URL" value={instance.instanceUrl} />
        {instance.credentialName && <InfoRow label="Credential" value={instance.credentialName} />}
        {enabledRow}
      </dl>
    </DrawerCard>
  );
}
