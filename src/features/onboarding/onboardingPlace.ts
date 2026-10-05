/**
 * Where the hire is on the Onboarding page right now: the step they have open, or failing that the
 * phase they are looking at.
 *
 * The page keeps this in its own state — which item is unfolded, which phase is selected — and the
 * address does not carry it: `/onboarding/:stepId` is only a way *in*, and the page replaces it once
 * it has landed. So anything outside the page that wants to say "this was found in that step" asks
 * here instead. The board is the reader: a note kept while a step is open is a note about that step,
 * and the board files it under the step's phase (see `board/layout/pathStages.ts`).
 *
 * A module value rather than a context, because the readers — the selection toolbar, the save
 * buttons in the buddy dock — are mounted beside the routes and not under them, and because the
 * question is only ever asked at the moment something is saved, never rendered from.
 */
export type OnboardingPlace = { kind: "step" | "phase"; id: string; title: string };

let current: OnboardingPlace | null = null;

/** Set by the Onboarding page as the hire moves around it, and cleared when they leave it. */
export function setOnboardingPlace(place: OnboardingPlace | null): void {
  current = place;
}

/** The step or phase open on the Onboarding page, or null when nothing is (or the page is not up). */
export function onboardingPlace(): OnboardingPlace | null {
  return current;
}

/**
 * The address that finds a place again without starting anything.
 *
 * `?step=` and `?phase=` rather than `/onboarding/:stepId`: the path segment unfolds a step *and
 * starts it* if it was waiting, and following a link back from a note is looking something up, not
 * beginning the work. A step also carries `&open=1`, so it lands unfolded — the words a note was
 * kept from are inside it — but still not started. See `OnBoardingPage`.
 */
export function onboardingPlaceUrl(place: Pick<OnboardingPlace, "kind" | "id">): string {
  const url = `/onboarding?${place.kind}=${encodeURIComponent(place.id)}`;

  return place.kind === "step" ? `${url}&open=1` : url;
}
