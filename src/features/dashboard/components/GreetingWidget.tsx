import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { useAuth } from "../../../context/useAuth";
import type { DashboardWidgetSize } from "../layout/types";
import { DashboardHero } from "./DashboardHero";

/** Recomputed every second, because the greeting shows a running clock. */
function useCurrentTime(): Date {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return currentTime;
}

function greetingFor(hour: number): string {
  if (hour < 6) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type GreetingContent = {
  greeting: string;
  displayName: string;
  formattedDate: string;
  formattedTime: string;
  profileIcon?: string | null;
  fallbackName: string;
  seed?: string;
};

/**
 * The greeting for a card that is a quarter or a half of a row.
 *
 * Stacked rather than a squeezed copy of the wide hero: the hero puts the clock beside the
 * name, and at this width that pair either wraps into a ragged block or shrinks the clock
 * until it is no longer the thing you glance at. Here the clock is the headline and the
 * greeting introduces it.
 *
 * Everything is centred on both axes. The cell is a fixed height whatever it holds, so a
 * compact card hung from the top would sit in a pool of its own empty space.
 *
 * `small` drops the date. It is the least urgent line on the card and the first thing that
 * would otherwise wrap across three lines in a single column.
 */
function CompactGreeting({ content, showDate }: { content: GreetingContent; showDate: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-2xl p-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-app-brand/12 via-transparent to-transparent"
      />

      <motion.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { x: [0, 16, 0], y: [0, -12, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-20 -right-16 h-52 w-52 rounded-full bg-app-brand/25 blur-3xl"
      />

      <div className="relative flex max-w-full items-center gap-3">
        <div className="relative shrink-0">
          <div
            aria-hidden="true"
            className="absolute -inset-1 rounded-full bg-gradient-to-tr from-app-progress-fill to-app-progress-fill-end opacity-60 blur-[6px]"
          />
          <div className="relative rounded-full ring-2 ring-app-surface">
            <UserAvatar
              size={40}
              profileIcon={content.profileIcon ?? undefined}
              fallbackName={content.fallbackName}
              seed={content.seed}
            />
          </div>
        </div>

        <p className="min-w-0 truncate text-sm font-semibold text-app-text">
          {content.greeting}, {content.displayName}
        </p>
      </div>

      <p className="relative mt-4 text-4xl font-light text-app-text/80 tabular-nums">
        {content.formattedTime}
      </p>

      {showDate && (
        <p className="relative mt-1 truncate text-xs text-app-text-muted">
          {content.formattedDate}
        </p>
      )}
    </section>
  );
}

/**
 * The masthead as a placeable widget: greeting, date and clock.
 *
 * Owns the clock rather than taking it as props, which is what lets the dashboard treat it
 * like any other card — a widget the user can move or remove cannot have the page holding
 * its state, or removing it would leave an interval running for nobody.
 */
export function GreetingWidget({ size }: { size: DashboardWidgetSize }) {
  const { profile } = useAuth();
  const currentTime = useCurrentTime();

  const displayName = profile?.firstName || profile?.username || "User";

  const content: GreetingContent = {
    greeting: greetingFor(currentTime.getHours()),
    displayName,
    formattedDate: currentTime.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    formattedTime: currentTime.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    profileIcon: profile?.profileIcon,
    fallbackName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : displayName,
    seed: profile?.id,
  };

  if (size === "wide") return <DashboardHero {...content} />;

  return <CompactGreeting content={content} showDate={size === "medium"} />;
}
