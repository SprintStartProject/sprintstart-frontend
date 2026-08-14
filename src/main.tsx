import { dismissBootSplash } from "./bootSplash";

// The Keycloak login theme is built from this same `index.html`, so it inherits
// the boot splash meant for the app. It is taken down here rather than left to
// the dead man's switch in the page — otherwise the sign-in form spends its
// first seconds hidden behind a rocket. `"now"` rather than `"instant"`: it
// still guarantees no flight ever plays (the exiting flag it sets blocks the
// inline script's `fly()` synchronously, same as `"instant"` would), but fades
// the splash out over ~520ms instead of popping it away outright — bridging
// the gap between this line running and `KcPage` actually mounting, which
// otherwise reads as a flash of the flat boot background with nothing on it.
if (window.kcContext !== undefined) {
  dismissBootSplash("now");
  void import("./keycloak-theme/main");
} else if (import.meta.env.VITE_KC_DEV === "true") {
  dismissBootSplash("now");
  void import("./keycloak-theme/main.dev");
} else {
  void import("./main-app");
}
