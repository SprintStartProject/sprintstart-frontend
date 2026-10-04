import { onboardingPlace, onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import type { CardOrigin } from "./cardOrigins";
import { takeRecapOrigin } from "./phaseRecaps";

/** Whether an in-app path is the Onboarding page, with or without a step after it. */
function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

/**
 * The step (or phase) a card kept right now belongs to, when the hire is on the Onboarding page.
 *
 * The fallback for saves that bring no origin of their own — a reply kept from the buddy dock while
 * a step is open is the case it exists for. Without it such a card is tied to nothing, and the board
 * can only ever file it under Now. Null anywhere else in the app: a note kept from a chat about a
 * step is not thereby *in* the step, and guessing would be worse than saying nothing.
 *
 * The one exception is a recap the board just asked the buddy for (`phaseRecaps.ts`): that is about
 * a phase wherever the hire happens to be when they keep it.
 */
export function onboardingOrigin(pathname: string): CardOrigin | null {
  const recap = takeRecapOrigin();
  if (recap) return recap;

  if (!isOnboardingPath(pathname)) return null;

  const place = onboardingPlace();
  return place ? { url: onboardingPlaceUrl(place), label: place.title } : null;
}

/**
 * A selection's origin, pointed at the open step rather than at the page as a whole.
 *
 * Text selected on the Onboarding page would otherwise be recorded as `/onboarding#:~:text=…` — a
 * way back to the page, and no word about which of its forty steps the words were in. The text
 * fragment is kept, so the link still names the words.
 */
export function withOnboardingPlace(origin: string): string {
  const [path, hash = ""] = origin.split("#", 2);
  const pathname = path.split("?", 1)[0];
  if (!isOnboardingPath(pathname)) return origin;

  const place = onboardingPlace();
  if (!place) return origin;

  return `${onboardingPlaceUrl(place)}${hash ? `#${hash}` : ""}`;
}
