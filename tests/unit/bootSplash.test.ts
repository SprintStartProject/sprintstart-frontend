import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dismissBootSplash, markSigningOut, rememberBootGreeting } from "../../src/bootSplash";

/** Stands in for the splash markup `index.html` paints before the bundle loads. */
function mountSplash(): HTMLElement {
  const splash = document.createElement("div");
  splash.id = "boot-splash";
  document.body.appendChild(splash);
  return splash;
}

describe("bootSplash", () => {
  beforeEach(() => {
    document.getElementById("boot-splash")?.remove();
    delete window.__bootSplash;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when the app renders without index.html", () => {
    // Tests and Storybook mount the app on their own page; the splash is
    // not there to be found and asking for it must not throw.
    expect(() => dismissBootSplash()).not.toThrow();
  });

  it("waits for the launch to finish before fading", () => {
    vi.useFakeTimers();
    const splash = mountSplash();

    // Ready almost immediately — a fast, warm reload.
    window.__bootSplash = { start: Date.now(), flightMs: 2000 };
    dismissBootSplash();

    // Cutting a launch off halfway reads as a glitch, so the fade holds.
    vi.advanceTimersByTime(1500);
    expect(splash).not.toHaveClass("is-ready");
    expect(splash).toBeInTheDocument();

    vi.advanceTimersByTime(600);
    expect(splash).toHaveClass("is-ready");

    vi.advanceTimersByTime(600);
    expect(document.getElementById("boot-splash")).not.toBeInTheDocument();
  });

  it("fades straight away when the launch has already played out", () => {
    vi.useFakeTimers();
    const splash = mountSplash();

    // The slow case: the flight ended long before the app was ready, and
    // the user has been reading the held frame since.
    window.__bootSplash = { start: Date.now() - 9000, flightMs: 2000 };
    dismissBootSplash();

    vi.advanceTimersByTime(0);
    expect(splash).toHaveClass("is-ready");
  });

  it("does not queue a second exit while the first one is waiting", () => {
    vi.useFakeTimers();
    const splash = mountSplash();
    window.__bootSplash = { start: Date.now(), flightMs: 2000 };

    // Auth settling can re-run the effect that calls this.
    dismissBootSplash();
    dismissBootSplash();
    dismissBootSplash();

    vi.advanceTimersByTime(3000);
    expect(document.getElementById("boot-splash")).not.toBeInTheDocument();
    expect(splash.dataset.exiting).toBe("true");
  });

  it("does not wait for the flight when the launch was for nobody", () => {
    vi.useFakeTimers();
    const splash = mountSplash();
    window.__bootSplash = { start: Date.now(), flightMs: 2000 };

    // Signed out: a login form is next, so the send-off is cut.
    dismissBootSplash("now");

    vi.advanceTimersByTime(0);
    expect(splash).toHaveClass("is-ready");
  });

  it("removes the splash instantly for the Keycloak login theme", () => {
    mountSplash();
    window.__bootSplash = { start: Date.now(), flightMs: 2000 };

    dismissBootSplash("instant");

    // Nothing was being loaded into, so there is no launch to sit through.
    expect(document.getElementById("boot-splash")).not.toBeInTheDocument();
  });

  it("leaves a note for the load that follows a sign-out", () => {
    markSigningOut();

    // The load after `keycloak.logout()` carries nothing on the URL to tell
    // it apart from a cold start, so this is the only way it can know not
    // to start a launch for somebody on their way out.
    expect(window.sessionStorage.getItem("sprintstart.boot.signout")).toBe("1");
  });

  it("remembers a first name for the next boot, and forgets it on sign-out", () => {
    rememberBootGreeting("David");
    expect(window.localStorage.getItem("sprintstart.boot.greeting")).toBe("David");

    rememberBootGreeting(null);
    expect(window.localStorage.getItem("sprintstart.boot.greeting")).toBeNull();
  });

  // The note is what stops the outbound leg flying into a redirect and the launch playing
  // twice on every reload. It is written by the leg that comes back from the identity
  // provider; this is the half that takes it back when that stops happening.
  it("keeps the round-trip note when the leg that stayed is the one that flew", () => {
    vi.useFakeTimers();
    mountSplash();
    window.localStorage.setItem("sprintstart.boot.roundtrip", "1");

    // A return leg: it flew, which is exactly the round-trip the note records.
    window.__bootSplash = { start: Date.now(), flightMs: 2000 };
    dismissBootSplash();

    expect(window.localStorage.getItem("sprintstart.boot.roundtrip")).toBe("1");
  });

  it("forgets the round-trip note when a boot stays without ever flying", () => {
    vi.useFakeTimers();
    mountSplash();
    window.localStorage.setItem("sprintstart.boot.roundtrip", "1");

    // `flightMs: 0` is the outbound leg, and this one was not navigated away from -- so this
    // app no longer redirects on boot, and the outbound leg has to start flying again.
    window.__bootSplash = { start: Date.now(), flightMs: 0 };
    dismissBootSplash();

    expect(window.localStorage.getItem("sprintstart.boot.roundtrip")).toBeNull();
  });

  it("leaves the note alone on the loads that never fly for a reason of their own", () => {
    vi.useFakeTimers();

    // `"now"` is what `main.tsx` gives the Keycloak login theme and what `MomentsProvider`
    // gives a signed-out boot. Neither ever flies, and neither says anything about whether
    // the *app* round-trips -- the signed-out one demonstrably did, it just came back with
    // nobody signed in.
    mountSplash();
    window.localStorage.setItem("sprintstart.boot.roundtrip", "1");
    window.__bootSplash = { start: Date.now(), flightMs: 0 };
    dismissBootSplash("now");
    expect(window.localStorage.getItem("sprintstart.boot.roundtrip")).toBe("1");

    document.getElementById("boot-splash")?.remove();
    mountSplash();
    window.__bootSplash = { start: Date.now(), flightMs: 0 };
    dismissBootSplash("instant");
    expect(window.localStorage.getItem("sprintstart.boot.roundtrip")).toBe("1");
  });
});
