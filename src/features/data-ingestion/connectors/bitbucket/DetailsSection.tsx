import { DrawerCard } from "../../../../components/ui/DrawerCard.tsx";
import { InfoLinkRow, InfoRow } from "../../components/InfoRows.tsx";
import { bitbucketRepositoryOf } from "../../sourceDetails.ts";
import type { DetailsSectionProps } from "../types.ts";

/** The repository's identity in the details panel. */
export function BitbucketDetailsSection({ source, enabledRow }: DetailsSectionProps) {
  const repository = bitbucketRepositoryOf(source);

  return (
    <DrawerCard label="Repository" icon={source.icon} index={1} className="mt-4 sm:mt-5">
      <dl className="-my-1">
        <InfoRow label="Full name" value={repository?.fullName ?? source.name} />
        <InfoRow label="Workspace" value={repository?.workspace} />
        <InfoRow label="Slug" value={repository?.slug} />
        <InfoLinkRow label="URL" value={repository?.url} />
        <InfoRow label="Repository ID" value={repository?.repositoryId ?? source.sourceId} mono />
        {enabledRow}
      </dl>
    </DrawerCard>
  );
}
