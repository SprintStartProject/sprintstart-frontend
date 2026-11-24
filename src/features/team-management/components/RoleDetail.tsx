import { X } from "lucide-react";
import type { ReactNode } from "react";

type RoleDetailProps = {
  roleName: string;
  onClose: () => void;
  /** The member list: it takes the room, being the part that grows with the team. */
  members: ReactNode;
  /** The skills column, narrow beside it; the skill list stays short. */
  skills: ReactNode;
};

/**
 * The open role, expanded right under its row in the list. Everything about it lives in here --
 * who holds it, and which skills it carries -- so working on a role never means looking at two
 * places at once.
 */
export function RoleDetail({ roleName, onClose, members, skills }: RoleDetailProps) {
  return (
    <section className="rounded-xl border border-app-border-muted bg-app-bg/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* The row right above already names the role and says what it does; the heading
              stays for screen readers, who meet the panel without the row beside it. */}
          <p className="text-sm font-semibold text-app-brand">Manage role</p>
          <h3 className="sr-only">{roleName}</h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close role details"
          className="shrink-0 rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {members}
        {skills}
      </div>
    </section>
  );
}
