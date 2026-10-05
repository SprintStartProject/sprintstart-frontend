import { DrawerCard } from "../../../../components/ui/DrawerCard.tsx";
import { InfoRow } from "../../components/InfoRows.tsx";
import { notionWorkspaceOf } from "../../sourceDetails.ts";
import type { DetailsSectionProps } from "../types.ts";

/** The workspace's identity and the credential it is ingested with, in the details panel. */
export function NotionDetailsSection({ source, enabledRow }: DetailsSectionProps) {
  const workspace = notionWorkspaceOf(source);

  if (!workspace) return null;

  return (
    <DrawerCard label="Workspace" icon={source.icon} index={1} className="mt-4 sm:mt-5">
      <dl className="-my-1">
        <InfoRow label="Name" value={workspace.workspaceName} />
        {workspace.credentialName && (
          <InfoRow label="Credential" value={workspace.credentialName} />
        )}
        {enabledRow}
      </dl>
    </DrawerCard>
  );
}
