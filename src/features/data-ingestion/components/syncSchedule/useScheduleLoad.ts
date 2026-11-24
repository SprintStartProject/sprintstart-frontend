import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../../services/sources/syncSchedule.ts";
import type { ScheduleFormState } from "./useScheduleFormState";

type LoadInput = {
  /** Reloads the form when it changes; pair it with `loadConfig`. */
  loadKey?: string;
  loadConfig?: () => Promise<SyncScheduleConfig>;
  initialConfig?: SyncScheduleRequest;
  adopt: ScheduleFormState["adopt"];
};

export type ScheduleLoad = {
  loadState: "loading" | "idle" | "error";
  /** Only the *load* failure, which stays inline because the form has nothing to show without a config. */
  errorMessage: string | null;
  nextSyncAt: string | null;
  /** Takes a freshly read config as the form and its next-sync time. */
  applyLoaded: (config: SyncScheduleConfig) => void;
};

/** Fills the form from `initialConfig`, or from `loadConfig` whenever `loadKey` changes. */
export function useScheduleLoad({
  loadKey,
  loadConfig,
  initialConfig,
  adopt,
}: LoadInput): ScheduleLoad {
  const [nextSyncAt, setNextSyncAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<ScheduleLoad["loadState"]>(
    loadConfig ? "loading" : "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyLoaded = useCallback(
    (config: SyncScheduleConfig) => {
      adopt(config.autoUpdate, config.spec);
      setNextSyncAt(config.nextSyncAt);
    },
    [adopt],
  );

  useEffect(() => {
    if (loadConfig || !initialConfig) return;

    void Promise.resolve().then(() => adopt(initialConfig.autoUpdate, initialConfig.schedule));
  }, [initialConfig, loadConfig, adopt]);

  // Keep the latest loader in a ref so the load effect can depend only on the stable `loadKey`.
  // Without this the effect re-ran on every parent render (the details page rebuilds
  // `loadConfig`'s identity while polling), which reloaded the config and discarded whatever the
  // user had just selected.
  const loadConfigRef = useRef(loadConfig);
  useEffect(() => {
    loadConfigRef.current = loadConfig;
  });

  useEffect(() => {
    let isMounted = true;

    const loader = loadConfigRef.current;
    if (!loader) return undefined;

    void Promise.resolve().then(async () => {
      if (!isMounted) return;

      setLoadState("loading");
      setErrorMessage(null);

      try {
        const config = await loader();

        if (!isMounted) return;

        applyLoaded(config);
        setLoadState("idle");
      } catch (error) {
        if (!isMounted) return;

        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load sync config");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadKey, applyLoaded]);

  return { loadState, errorMessage, nextSyncAt, applyLoaded };
}
