import { useMemo, type ReactNode } from "react";
import { Building2, CalendarDays, ExternalLink, Hash, Lock, Users } from "lucide-react";
import { BitbucketIcon } from "../../../../components/icons/BitbucketIcon.tsx";
import {
  parseBitbucketWorkspaceMetadata,
  type BitbucketWorkspaceMetadata,
} from "../../../knowledge-base/bitbucketWorkspaceMetadata.ts";
import type { Artifact } from "../../../knowledge-base/types.ts";

/** A labeled metadata row (icon + label + value) of the workspace profile. */
function WorkspaceProfileRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-app-text-subtle">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-app-text-subtle">{label}</dt>
        <dd className="text-sm text-app-text">{children}</dd>
      </div>
    </div>
  );
}

/** Formats the workspace's ISO creation time as a date, or null when it does not parse. */
function formatWorkspaceDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Workspace profile, rendered purely from the artifact's `metadata` JSON. A
 * workspace has no teams, so only its members are listed.
 */
function WorkspaceMetadataView({
  metadata,
  title,
}: {
  metadata: BitbucketWorkspaceMetadata | null;
  title: string | null;
}) {
  if (!metadata) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-app-text-muted">
        <Building2 className="h-10 w-10 opacity-50" />
        <p className="text-sm">Workspace profile unavailable.</p>
      </div>
    );
  }

  const workspaceUrl =
    metadata.url ?? `https://bitbucket.org/${encodeURIComponent(metadata.workspace)}`;
  const createdOn = formatWorkspaceDate(metadata.createdOn);

  return (
    <div className="space-y-6" data-testid="bitbucket-workspace-view">
      <header className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl border border-app-border bg-app-bg-soft p-2.5">
          <BitbucketIcon className="h-6 w-6 text-app-text-muted" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-app-text">
            {metadata.name || title || "Workspace"}
          </h2>
          <a
            href={workspaceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-app-brand hover:underline"
          >
            {metadata.workspace}
          </a>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" data-testid="workspace-quick-links">
        <a
          href={`https://bitbucket.org/${encodeURIComponent(metadata.workspace)}/workspace/repositories`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-bg px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand/50 hover:text-app-brand"
        >
          <Hash className="h-3.5 w-3.5" />
          <span>Repositories</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {metadata.isPrivate !== null && (
          <WorkspaceProfileRow icon={<Lock className="h-4 w-4" />} label="Visibility">
            {metadata.isPrivate ? "Private" : "Public"}
          </WorkspaceProfileRow>
        )}
        {createdOn && (
          <WorkspaceProfileRow icon={<CalendarDays className="h-4 w-4" />} label="Created">
            {createdOn}
          </WorkspaceProfileRow>
        )}
      </dl>

      <section aria-label="Members">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-text">
          <Users className="h-4 w-4 text-app-text-subtle" />
          Members
          {metadata.members.length > 0 && (
            <span className="rounded-full bg-app-surface px-2 py-0.5 text-xs font-bold text-app-text-subtle">
              {metadata.members.length}
            </span>
          )}
        </h3>

        {metadata.members.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {metadata.members.map((member, index) => (
              <li
                key={member.accountId ?? `${member.nickname ?? member.displayName}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text-muted"
              >
                <Users className="h-3 w-3" />
                {member.displayName ?? member.nickname ?? "Unknown member"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-app-text-muted">No members visible in this workspace.</p>
        )}
      </section>
    </div>
  );
}

/**
 * The knowledge base's view of a Bitbucket workspace artifact, which has no stored
 * content to fetch: it renders from the artifact's own `metadata`.
 */
export function BitbucketWorkspaceMetadataView({ artifact }: { artifact: Artifact }) {
  const metadata = useMemo(() => parseBitbucketWorkspaceMetadata(artifact.metadata), [artifact]);

  return <WorkspaceMetadataView metadata={metadata} title={artifact.title} />;
}
