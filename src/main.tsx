import { dismissBootSplash } from "./bootSplash";

// The Keycloak login theme is built from this same `index.html`, so it inherits
// the boot splash meant for the app. It is taken down here rather than left to
// the dead man's switch in the page — otherwise the sign-in form spends its
// first seconds hidden behind a rocket.
if (window.kcContext !== undefined) {
  dismissBootSplash("instant");
  void import("./keycloak-theme/main");
} else if (import.meta.env.VITE_KC_DEV === "true") {
  dismissBootSplash("instant");
  void import("./keycloak-theme/main.dev");
} else {
  void import("./main-app");
}
