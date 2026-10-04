import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../../../../src/auth/accessPolicy";
import {
  APP_GUIDE_EXCLUDED_ROUTES,
  APP_GUIDE_ROUTES,
} from "../../../../src/features/buddy/appGuideRoutes";

/**
 * The buddy's map of the app lives in the backend (`AppGuide.kt`). This is the tripwire on this
 * side: a page added to the access policy without a decision about the guide fails here, in the
 * repo the page was added in.
 */
describe("the buddy's app guide coverage", () => {
  it("covers or deliberately excludes every route in the access policy", () => {
    const decided = new Set<string>([
      ...APP_GUIDE_ROUTES,
      ...Object.keys(APP_GUIDE_EXCLUDED_ROUTES),
    ]);

    // When this fails: describe the new page in the backend's onboarding/service/AppGuide.kt and
    // add it to APP_GUIDE_ROUTES, or add it to APP_GUIDE_EXCLUDED_ROUTES with the reason.
    expect(APP_ROUTES.filter((route) => !decided.has(route))).toEqual([]);
  });

  it("never lists a route both as described and as excluded", () => {
    const excluded = Object.keys(APP_GUIDE_EXCLUDED_ROUTES);

    expect(APP_GUIDE_ROUTES.filter((route) => excluded.includes(route))).toEqual([]);
  });

  it("names only routes the access policy knows", () => {
    expect(APP_GUIDE_ROUTES.filter((route) => !APP_ROUTES.includes(route))).toEqual([]);
  });
});
