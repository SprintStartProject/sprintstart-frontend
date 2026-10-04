import { useMemo, type ReactNode } from "react";
import { Building2, ExternalLink, Globe, Hash, Link2, Mail, MapPin, Users } from "lucide-react";
import {
  parseOrgMetadata,
  type OrgMetadataArtifactMetadata,
  type OrgMetadataTeam,
} from "../../../knowledge-base/orgMetadata.ts";
import type { Artifact } from "../../../knowledge-base/types.ts";

/**
 * Renders a labeled metadata row (icon + label + value) for the org profile.
 */
function OrgProfileRow({
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

/** GitHub's `blog` is usually a URL; link it, prefixing a scheme when bare. */
function normalizeUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  // Shortest realistic hostname is 4 chars (e.g. a.io); anything shorter
  // (including "N/A", "?", whitespace) is not a real URL and must not be linked.
  if (!trimmed || trimmed.length < 4) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Org profile view, rendered purely from the artifact's `metadata` JSON.
 *  Teams and members are always fully expanded. */
function OrgMetadataView({
  metadata,
  title,
}: {
  metadata: OrgMetadataArtifactMetadata | null;
  title: string | null;
}) {
  if (!metadata) {
    // Known backend gap: the org artifact exists but its metadata couldn't be
    // parsed. Show a quiet empty state instead of killing the drawer or falling
    // through to the (redirect-following) content fetch.
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-app-text-muted">
        <Building2 className="h-10 w-10 opacity-50" />
        <p className="text-sm">Organization profile unavailable.</p>
      </div>
    );
  }

  const blogUrl = normalizeUrl(metadata.blog);

  return (
    <div className="space-y-6" data-testid="org-metadata-view">
      <header className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl border border-app-border bg-app-bg-soft p-2.5">
          <Building2 className="h-6 w-6 text-app-text-muted" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-app-text">
            {metadata.name || title || "Organization"}
          </h2>
          <a
            href={`https://github.com/${metadata.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-app-brand hover:underline"
          >
            @{metadata.login}
          </a>
          {metadata.description && (
            <p className="mt-2 text-sm text-app-text-muted">{metadata.description}</p>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2" data-testid="org-quick-links">
        <a
          href={`https://github.com/orgs/${encodeURIComponent(metadata.login)}/repositories`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-bg px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand/50 hover:text-app-brand"
        >
          <Hash className="h-3.5 w-3.5" />
          <span>Repositories</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
        <a
          href={`https://github.com/orgs/${encodeURIComponent(metadata.login)}/people`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-bg px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:border-app-brand/50 hover:text-app-brand"
        >
          <Users className="h-3.5 w-3.5" />
          <span>People</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {metadata.location && (
          <OrgProfileRow icon={<MapPin className="h-4 w-4" />} label="Location">
            {metadata.location}
          </OrgProfileRow>
        )}
        {blogUrl && (
          <OrgProfileRow icon={<Globe className="h-4 w-4" />} label="Blog">
            <a
              href={blogUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-app-brand hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              {metadata.blog}
            </a>
          </OrgProfileRow>
        )}
        {metadata.company && (
          <OrgProfileRow icon={<Building2 className="h-4 w-4" />} label="Company">
            {metadata.company}
          </OrgProfileRow>
        )}
        {metadata.email && (
          <OrgProfileRow icon={<Mail className="h-4 w-4" />} label="Email">
            <a href={`mailto:${metadata.email}`} className="text-app-brand hover:underline">
              {metadata.email}
            </a>
          </OrgProfileRow>
        )}
        <OrgProfileRow icon={<Hash className="h-4 w-4" />} label="Repositories">
          {metadata.publicRepos !== null && metadata.privateRepos !== null ? (
            <>
              {metadata.publicRepos} public · {metadata.privateRepos} private
            </>
          ) : metadata.publicRepos !== null ? (
            <>{metadata.publicRepos} public</>
          ) : (
            "N/A"
          )}
        </OrgProfileRow>
      </dl>

      <section aria-label="Teams">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-text">
          <Users className="h-4 w-4 text-app-text-subtle" />
          Teams
        </h3>
        {metadata.teams && metadata.teams.length > 0 ? (
          <div className="space-y-3">
            {metadata.teams.map((team: OrgMetadataTeam) => (
              <div
                key={team.slug ?? team.name}
                className="rounded-xl border border-app-border bg-app-bg-soft/60 p-3.5"
              >
                <p className="text-sm font-semibold text-app-text">{team.name}</p>
                {team.members.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {team.members.map((member) => (
                      <li
                        key={member.login}
                        className="rounded-md border border-app-border bg-app-bg px-2 py-0.5 text-xs text-app-text-muted"
                      >
                        {member.login}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-app-text-muted">
            No teams configured or visible in this organization.
          </p>
        )}
      </section>

      <section aria-label="Members">
        <div className="mb-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-app-text">
            <Users className="h-4 w-4 text-app-text-subtle" />
            Members
            {metadata.members.length > 0 && (
              <span className="rounded-full bg-app-surface px-2 py-0.5 text-xs font-bold text-app-text-subtle">
                {metadata.members.length}
              </span>
            )}
          </h3>
          <p className="mt-1 text-xs text-app-text-muted">
            Only members with public organization visibility on GitHub are listed.
          </p>
        </div>

        {metadata.members.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {metadata.members.map((member) => (
              <li key={member.login}>
                <a
                  href={member.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text-muted transition-colors hover:border-app-brand/50 hover:text-app-brand"
                >
                  <Users className="h-3 w-3" />
                  {member.login}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-app-text-muted">
            No public members visible. Members can set their organization membership to public on
            GitHub.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The knowledge base's view of a GitHub organization artifact, which has no stored
 * content to fetch: it renders from the artifact's own `metadata`.
 */
export function GithubOrgMetadataView({ artifact }: { artifact: Artifact }) {
  const metadata = useMemo(() => parseOrgMetadata(artifact.metadata), [artifact]);

  return <OrgMetadataView metadata={metadata} title={artifact.title} />;
}
