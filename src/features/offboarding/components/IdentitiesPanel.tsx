import { Link2, Link2Off, Users } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../context/useToast";
import type { AliasLink, MemberMatch } from "../../../services/offboardingTypes";
import { PmCard, PmCardHeader } from "../../pm-area";
import { formatDay } from "../format";
import { useIdentityLinks } from "../useIdentityLinks";
import { useProjectMembers } from "../useProjectMembers";

function Suggestion({
  link,
  onLink,
}: {
  link: AliasLink;
  onLink: (alias: string, person: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-app-brand-soft px-3 py-2 text-sm text-app-text">
      <span>
        Is <span className="font-mono">{link.alias}</span> also{" "}
        <span className="font-mono">{link.person}</span>?
      </span>
      <Button
        size="xs"
        variant="secondary"
        aria-label={`Link ${link.alias} to ${link.person}`}
        onClick={() => onLink(link.alias, link.person)}
        icon={<Link2 className="h-3.5 w-3.5" />}
      >
        Link
      </Button>
    </div>
  );
}

function MemberRow({
  member,
  onLink,
  onUnlink,
}: {
  member: MemberMatch;
  onLink: (alias: string, person: string) => void;
  onUnlink: (alias: string) => void;
}) {
  return (
    <li className="border-t border-app-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-app-text">{member.displayName}</p>
        <p className="text-xs text-app-text-muted">
          {member.matched
            ? member.lastSeenAt
              ? `last seen ${formatDay(member.lastSeenAt)}${member.inactive ? " · inactive" : ""}`
              : "seen in the history"
            : "no trace in the history"}
        </p>
      </div>
      <ul className="mt-1 space-y-1">
        {member.identities.map((seen) => (
          <li key={seen.identity} className="flex items-center gap-2 text-sm text-app-text-muted">
            <span className="font-mono">{seen.identity}</span>
            <span>
              {Object.entries(seen.touches)
                .map(([source, count]) => `${count} ${source}`)
                .join(" · ")}
            </span>
            {seen.person !== seen.identity && (
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Unlink ${seen.identity}`}
                onClick={() => onUnlink(seen.identity)}
                icon={<Link2Off className="h-3.5 w-3.5" />}
              >
                Unlink
              </Button>
            )}
          </li>
        ))}
      </ul>
      {member.suggestions.map((link) => (
        <Suggestion key={`${link.alias}>${link.person}`} link={link} onLink={onLink} />
      ))}
    </li>
  );
}

/**
 * Which member of the project is which names in the history, with the links the system suggests
 * ready to confirm. A confirmed link makes two names count as one person in every ranking.
 */
export function IdentitiesPanel({ projectId }: { projectId: string }) {
  const toast = useToast();
  const roster = useProjectMembers(projectId);
  const links = useIdentityLinks(projectId);

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch {
      toast.error(failure);
    }
  };

  const members = roster.data?.members ?? [];
  return (
    <PmCard aria-label="Identities">
      <PmCardHeader
        icon={Users}
        title="Who is who in the history"
        meta={roster.data ? `${roster.data.matched} of ${roster.data.total} found` : undefined}
      />
      {roster.error && (
        <EmptyState title="The members could not be loaded" size="sm">
          Try again in a moment.
        </EmptyState>
      )}
      <ul className="-mx-4 -mb-4 border-t border-app-border">
        {members.map((member) => (
          <MemberRow
            key={member.member}
            member={member}
            onLink={(alias, person) =>
              void run(() => links.link({ alias, person }), "The link could not be saved.")
            }
            onUnlink={(alias) =>
              void run(() => links.unlink(alias), "The link could not be removed.")
            }
          />
        ))}
      </ul>
    </PmCard>
  );
}
