import { DrawerCard } from "../../../../components/ui/DrawerCard.tsx";
import { InfoLinkRow, InfoRow } from "../../components/InfoRows.tsx";
import { confluenceSpaceOf } from "../../sourceDetails.ts";
import type { DetailsSectionProps } from "../types.ts";

/** The space's identity and the credential it is ingested with, in the details panel. */
export function ConfluenceDetailsSection({ source, enabledRow }: DetailsSectionProps) {
  const space = confluenceSpaceOf(source);

  return (
    <DrawerCard label="Space" icon={source.icon} index={1} className="mt-4 sm:mt-5">
      <dl className="-my-1">
        <InfoRow label="Space name" value={source.name} />
        {space?.spaceKey && <InfoRow label="Space key" value={space.spaceKey} />}
        {space?.baseUrl && <InfoLinkRow label="Base URL" value={space.baseUrl} />}
        <InfoRow label="Space ID" value={space?.spaceId ?? source.sourceId} mono />
        {space?.credentialName && <InfoRow label="Credential" value={space.credentialName} />}
        {enabledRow}
      </dl>
    </DrawerCard>
  );
}
