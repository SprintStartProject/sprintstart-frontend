import { motion, useReducedMotion } from "framer-motion";
import { UserAvatar } from "../../../components/common/UserAvatar";

type DashboardHeroProps = {
  greeting: string;
  displayName: string;
  formattedDate: string;
  formattedTime: string;
  profileIcon?: string | null;
  fallbackName: string;
  seed?: string;
};

/**
 * Masthead of the dashboard: greeting, date and a live clock over a soft
 * brand-tinted gradient with two slowly drifting glow blobs.
 *
 * The blobs are purely decorative (`aria-hidden`) and hold still for users
 * who prefer reduced motion.
 */
export function DashboardHero({
  greeting,
  displayName,
  formattedDate,
  formattedTime,
  profileIcon,
  fallbackName,
  seed,
}: DashboardHeroProps) {
  const reduceMotion = useReducedMotion();

  const drift = reduceMotion
    ? undefined
    : {
        x: [0, 24, 0],
        y: [0, -18, 0],
      };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-app-border bg-app-surface px-6 py-8 sm:px-8 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-app-brand/12 via-transparent to-transparent"
      />

      <motion.div
        aria-hidden="true"
        animate={drift}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-app-brand/25 blur-3xl"
      />

      <motion.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { x: [0, -20, 0], y: [0, 16, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--progress-fill-end)" }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-app-progress-fill to-app-progress-fill-end opacity-60 blur-[6px]"
            />
            <div className="relative rounded-full ring-2 ring-app-surface">
              <UserAvatar
                size={56}
                profileIcon={profileIcon ?? undefined}
                fallbackName={fallbackName}
                seed={seed}
              />
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-app-text-muted">{formattedDate}</p>
            <h2 className="bg-gradient-to-r from-app-text via-app-text to-app-brand bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
              {greeting}, {displayName}
            </h2>
          </div>
        </div>

        <p className="text-4xl font-light text-app-text/80 tabular-nums sm:text-5xl">
          {formattedTime}
        </p>
      </div>
    </section>
  );
}
