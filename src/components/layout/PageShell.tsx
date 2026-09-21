import type { ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { SkeletonLine } from "../ui/Skeleton";
import { PageHeader } from "./PageHeader";

export type PageShellFrame = "page" | "content" | "admin";

const FRAME_CLASS_NAMES: Record<PageShellFrame, string> = {
  page: "app-page-frame",
  content: "app-page-content",
  admin: "admin-page-frame",
};

export type PageShellBack =
  | { label: string; to: string; onClick?: never }
  | { label: string; onClick: () => void; to?: never };

type PageShellProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  /** Replaces the hand-built "Back to X" buttons every page used to grow its own. */
  back?: PageShellBack;
  /** Which of the three existing gutter utilities the header and content share. */
  frame?: PageShellFrame;
  /** Escape hatch for the couple of pages whose width predates the three gutters. */
  frameClassName?: string;
  /** Content below the title row, still inside the header band — a stats grid, a summary bar, a rail. */
  bandExtra?: ReactNode;
  /** Suppresses the whole band, for a page that can ask to fill the screen (e.g. the board in focus mode). */
  hideHeader?: boolean;
  headerClassName?: string;
  mainClassName?: string;
  /** For the one page that still steers a two-finger swipe gesture off the content element. */
  mainRef?: Ref<HTMLElement>;
  /**
   * The content area — loading, error and success all render here, so the band above
   * (and the app shell above that) never has to be torn down for any of them.
   */
  children: ReactNode;
};

function BackButton({ back }: { back: PageShellBack }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      onClick={back.onClick ?? (() => void navigate(back.to))}
      icon={<ArrowLeft className="h-4 w-4" />}
      className="mb-4"
    >
      {back.label}
    </Button>
  );
}

/**
 * The header band and content area every routed page shares.
 *
 * The band renders unconditionally — a page passes its loading/error/success
 * state as `children`, not as a reason to skip the band — so navigating to a
 * page is one layout change (nothing, then the page), not two (nothing, a
 * centered spinner, then the whole page including its own header).
 */
export function PageShell({
  icon,
  title,
  subtitle,
  actions,
  back,
  frame = "page",
  frameClassName,
  bandExtra,
  hideHeader = false,
  headerClassName = "",
  mainClassName = "",
  mainRef,
  children,
}: PageShellProps) {
  const frameClass = frameClassName ?? FRAME_CLASS_NAMES[frame];

  return (
    <div className="min-h-screen bg-app-bg">
      {!hideHeader && (
        <header
          className={`border-b border-app-border bg-app-bg/90 backdrop-blur-xl ${headerClassName}`}
        >
          <div className={`${frameClass} py-6`}>
            {back && <BackButton back={back} />}
            <PageHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
            {bandExtra && <div className="mt-4">{bandExtra}</div>}
          </div>
        </header>
      )}
      <main ref={mainRef} className={`${frameClass} ${mainClassName}`}>
        {children}
      </main>
    </div>
  );
}

/**
 * A title-less stand-in for `PageShell`, for the guards that sit above a routed page
 * and decide whether it may render at all (`ManagerAreaGuard`, `AuthGuard`). They
 * don't know the destination page's title, so showing one — even briefly, even
 * wrong — would be worse than showing none; the band here is a blank placeholder
 * that keeps the same footprint, so the real page's band doesn't pop in with a
 * different height once the guard's check resolves.
 */
export function PageShellSkeleton({ frame = "page" }: { frame?: PageShellFrame }) {
  const frameClass = FRAME_CLASS_NAMES[frame];

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
        <div className={`${frameClass} py-6`}>
          <SkeletonLine className="h-8 w-48" />
        </div>
      </header>
      <main className={`${frameClass} flex justify-center py-16`}>
        <Spinner size="lg" />
      </main>
    </div>
  );
}
