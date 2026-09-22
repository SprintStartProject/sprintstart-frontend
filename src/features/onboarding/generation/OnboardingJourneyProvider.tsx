import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isOnboardingAccessible } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { ApiError } from "../../../services/apiClient";
import { knowledgeService } from "../../../services/knowledgeService";
import { onboardingService } from "../../../services/onboardingService";
import { useProjectContext } from "../../projects/useProjectContext";
import type { OnboardingPathEndpoint } from "../types";
import { describeGenerationError } from "./generationErrors";
import {
  asFailureReason,
  OnboardingJourneyContext,
  type GenerationFailureReason,
  type GenerationPhaseProgress,
  type OnboardingAvailability,
  type OnboardingGeneration,
  type OnboardingJourneyValue,
  type UnavailableReason,
} from "./OnboardingJourneyContext";

/** How often a cut stream re-attaches to the same run before the member is told it is gone. */
const MAX_REATTACHES = 3;

const CONNECTION_LOST =
  "The connection to the build was lost. It may still be running -- open onboarding again in a moment.";

/**
 * What a stage line says about its phase.
 *
 * The backend guarantees three of its own detail lines and relays everything else verbatim from
 * the AI service, so this can only read what it is given. It reads the two openings the backend
 * does guarantee, and treats anything else as work in progress: matching "failed" or "error"
 * anywhere in a relayed line pinned a phase that says "retrying after an error" to a warning
 * triangle for the rest of the run, even though it went on to finish.
 *
 * A phase that genuinely failed is reported by the stream's `error` event, which ends the whole
 * generation -- that is the signal this does not have to guess at.
 *
 * **Backend TODO:** a structured state on the stage event would remove the guessing entirely.
 */
function phaseStateOf(detail: string): GenerationPhaseProgress["state"] {
  if (/^waiting/i.test(detail)) return "waiting";
  if (/^completed/i.test(detail)) return "done";
  return "working";
}

/**
 * Owns the onboarding journey above the router: the path generation, and whether onboarding has
 * anything to show.
 *
 * **The generation belongs to the app, not to the page.** It used to live in the onboarding page's
 * state, so switching to another page unmounted it, closed the stream and -- because the backend
 * collected the generation straight into that stream -- threw away minutes of work. Here the stream
 * survives navigation, the sidebar can show that something is being built, and a toast says when it
 * is ready. The backend now also runs the generation detached from the stream, so a reload re-attaches
 * to the same run instead of starting over (see `fetchGenerationStatus`).
 *
 * **The sidebar entry exists while there is something to do.** A path that exists, or one that can be
 * built: a selected project with a published blueprint and ingested content. Without those the page
 * could only ever end in an empty or failed generation, so the entry is left out -- like it was before
 * paths were built by hand. Anything that cannot be answered keeps the entry (fails open): hiding
 * navigation because a request blipped looks like the feature was taken away.
 */
export function OnboardingJourneyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const isAccessible = isOnboardingAccessible(profile);

  const [generation, setGeneration] = useState<OnboardingGeneration>({ status: "idle" });
  const [availability, setAvailability] = useState<OnboardingAvailability>("loading");
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  // Read by the stream's callbacks, which outlive the render they were created in. Refs, so that
  // neither a new toast nor a navigation recreates `startGeneration` and re-runs the checks below.
  const pathnameRef = useRef(location.pathname);
  const toastRef = useRef(toast);
  const navigateRef = useRef(navigate);
  useEffect(() => {
    pathnameRef.current = location.pathname;
    toastRef.current = toast;
    navigateRef.current = navigate;
  }, [location.pathname, navigate, toast]);

  // Stop watching when the provider goes away (sign-out). The backend keeps building regardless.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Re-attaches to a run whose stream was cut, before the member is told the connection is gone.
   * The backend runs the generation detached from the stream, so attaching again replays the
   * stages it has already reported.
   */
  const watchRef = useRef<(projectId: string, attempt: number) => void>(() => {});

  const watchGeneration = useCallback((projectId: string, attempt: number) => {
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    let builtPath: OnboardingPathEndpoint | null = null;

    setGeneration({ status: "running", projectId, startedAt: Date.now(), phases: [] });

    const finish = (next: OnboardingGeneration) => {
      runningRef.current = false;
      setGeneration(next);
    };

    const succeed = (path: OnboardingPathEndpoint | null) => {
      finish({ status: "done", path });
      setAvailability("path");
      setUnavailableReason(null);
      if (!pathnameRef.current.startsWith("/onboarding")) {
        toastRef.current.success("Your onboarding path is ready", {
          description: "Every phase has been put together for you.",
          action: { label: "Open", onClick: () => void navigateRef.current("/onboarding") },
        });
      }
    };

    const fail = (message: string, reason?: GenerationFailureReason) => {
      finish({ status: "error", message, reason });
      if (!pathnameRef.current.startsWith("/onboarding")) {
        toastRef.current.error("Your onboarding path could not be built", {
          description: message,
        });
      }
    };

    const lost = () => {
      finish({ status: "error", message: CONNECTION_LOST });
      if (!pathnameRef.current.startsWith("/onboarding")) {
        toastRef.current.error("The connection to your path build was lost", {
          description: CONNECTION_LOST,
        });
      }
    };

    void onboardingService
      .personalizePath(
        projectId,
        {
          onStage: (name, detail) => {
            if (!name) return;
            setGeneration((current) => {
              if (current.status !== "running") return current;
              const phases = [...current.phases];
              const index = phases.findIndex((phase) => phase.name === name);
              const entry: GenerationPhaseProgress = {
                name,
                detail: detail ?? "",
                state: phaseStateOf(detail ?? ""),
              };
              // A finished phase stays finished: late progress lines from its stream do not reopen it.
              if (index >= 0) {
                if (phases[index].state === "done") return current;
                phases[index] = entry;
              } else {
                phases.push(entry);
              }
              return { ...current, phases };
            });
          },
          onPath: (path) => {
            builtPath = path;
          },
          onDone: () => succeed(builtPath),
          onError: (message, reason) => {
            fail(describeGenerationError(message), asFailureReason(reason));
          },
          onInterrupted: () => {
            if (controller.signal.aborted) {
              runningRef.current = false;
              return;
            }
            // The run outlives its stream, so ask what actually happened rather than calling a
            // dropped connection a finished path.
            void onboardingService
              .fetchGenerationStatus(projectId)
              .then(async (status) => {
                if (controller.signal.aborted) {
                  runningRef.current = false;
                  return;
                }
                if (status.running) {
                  if (attempt >= MAX_REATTACHES) {
                    lost();
                    return;
                  }
                  runningRef.current = false;
                  watchRef.current(projectId, attempt + 1);
                  return;
                }
                // Not running any more: it either finished while we were away, or it never got
                // there. The path is the only honest answer.
                try {
                  succeed(await onboardingService.fetchPath());
                } catch {
                  lost();
                }
              })
              .catch(() => lost());
          },
        },
        controller.signal,
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          runningRef.current = false;
          return;
        }
        finish({
          status: "error",
          message: describeGenerationError(error instanceof Error ? error.message : ""),
        });
      });
  }, []);

  useEffect(() => {
    watchRef.current = watchGeneration;
  }, [watchGeneration]);

  const startGeneration = useCallback(
    (projectId: string) => watchGeneration(projectId, 0),
    [watchGeneration],
  );

  const clearGeneration = useCallback(() => {
    if (runningRef.current) return;
    setGeneration({ status: "idle" });
  }, []);

  const refreshAvailability = useCallback(() => setAvailabilityVersion((value) => value + 1), []);

  useEffect(() => {
    if (!isAccessible) return;
    let cancelled = false;

    async function resolve() {
      try {
        await onboardingService.fetchPath();
        if (cancelled) return;
        setAvailability("path");
        setUnavailableReason(null);
        return;
      } catch (error) {
        if (cancelled) return;
        if (!(error instanceof ApiError && error.status === 404)) {
          setAvailability("path");
          setUnavailableReason(null);
          return;
        }
      }

      if (!selectedProjectId) {
        setAvailability("unavailable");
        setUnavailableReason("no-project");
        return;
      }

      try {
        const status = await onboardingService.fetchGenerationStatus(selectedProjectId);
        if (cancelled) return;
        if (status.running) {
          setAvailability("buildable");
          setUnavailableReason(null);
          // Only the project the run is actually for. Falling back to whatever happened to be
          // selected meant POSTing `personalize` against a different project whenever the status
          // came back without `runningProjectId` -- starting a build nobody asked for.
          if (status.runningProjectId) startGeneration(status.runningProjectId);
          return;
        }
        if (!status.hasActiveBlueprint) {
          setAvailability("unavailable");
          // More than one published blueprint is a different fix from none at all.
          setUnavailableReason(
            (status.activeBlueprintCount ?? 0) > 1 ? "several-blueprints" : "no-blueprint",
          );
          return;
        }
      } catch (reason) {
        // Unknown is not "no": fall through to the content check, and fail open after that. Said
        // out loud, though -- an outage here is indistinguishable from "buildable" on screen.
        console.error("Could not read the onboarding generation status:", reason);
      }

      try {
        const hasContent = await knowledgeService.hasIngestedContent(selectedProjectId);
        if (cancelled) return;
        setAvailability(hasContent ? "buildable" : "unavailable");
        setUnavailableReason(hasContent ? null : "no-content");
      } catch (reason) {
        console.error("Could not check the project for ingested content:", reason);
        if (cancelled) return;
        setAvailability("buildable");
        setUnavailableReason(null);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [availabilityVersion, isAccessible, selectedProjectId, startGeneration]);

  const value = useMemo<OnboardingJourneyValue>(
    () => ({
      generation,
      startGeneration,
      clearGeneration,
      // A running generation always keeps the entry, whatever the last check said.
      availability: !isAccessible
        ? "unavailable"
        : generation.status === "running"
          ? "buildable"
          : availability,
      unavailableReason: isAccessible ? unavailableReason : null,
      refreshAvailability,
    }),
    [
      availability,
      clearGeneration,
      generation,
      isAccessible,
      refreshAvailability,
      startGeneration,
      unavailableReason,
    ],
  );

  return (
    <OnboardingJourneyContext.Provider value={value}>{children}</OnboardingJourneyContext.Provider>
  );
}
