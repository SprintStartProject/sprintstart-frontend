import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageShell, type PageShellBack } from "../../../components/layout/PageShell";
import { PmAreaNav } from "../PmAreaNav";
import { MemberPeekPanel } from "./MemberPeekPanel";

type PmPageShellProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  /** Only for a page that is a level *below* a section, like a member's full profile. */
  back?: PageShellBack;
  /** Drawn under the section bar, still inside the header band. */
  bandExtra?: ReactNode;
  /** Hides the section bar, for the full-profile page whose header is the member themselves. */
  hideNav?: boolean;
  mainClassName?: string;
  children: ReactNode;
};

/**
 * The frame of every page in the PM area: the app's page shell with the PM section bar in its
 * header band, and the member side panel mounted once so any page can open it.
 *
 * The same gutters and header spacing as the dashboard (`app-page-frame`, `py-6` band,
 * `py-6 lg:py-8` content). The PM pages had drifted across three widths — `max-w-7xl`, the
 * centred `app-page-content` column and the full frame — so moving between them made the whole
 * page jump sideways.
 */
export function PmPageShell({
  icon,
  title,
  subtitle,
  actions,
  back,
  bandExtra,
  hideNav = false,
  mainClassName = "",
  children,
}: PmPageShellProps) {
  return (
    <>
      <PageShell
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={actions}
        back={back}
        bandExtra={
          hideNav && !bandExtra ? undefined : (
            <div className="space-y-4">
              {!hideNav && <PmAreaNav />}
              {bandExtra}
            </div>
          )
        }
        mainClassName={`py-6 pb-24 lg:py-8 ${mainClassName}`}
      >
        {children}
      </PageShell>

      <MemberPeekPanel />
    </>
  );
}
