import { useEffect, useState } from "react";
import { useAuth } from "../../../context/useAuth";
import { DashboardHero } from "./DashboardHero";

/** Recomputed every second, because the hero shows a running clock. */
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

/**
 * The masthead as a placeable widget: greeting, date and clock.
 *
 * Owns the clock rather than taking it as props, which is what lets the dashboard treat it
 * like any other card — a widget the user can move or remove cannot have the page holding
 * its state, or removing it would leave an interval running for nobody.
 */
export function GreetingWidget() {
  const { profile } = useAuth();
  const currentTime = useCurrentTime();

  const displayName = profile?.firstName || profile?.username || "User";

  return (
    <DashboardHero
      greeting={greetingFor(currentTime.getHours())}
      displayName={displayName}
      formattedDate={currentTime.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
      formattedTime={currentTime.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
      profileIcon={profile?.profileIcon}
      fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : displayName}
      seed={profile?.id}
    />
  );
}
