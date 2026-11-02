import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useToast } from "../../../context/useToast";
import { SLIDING_PANEL_EXIT_MS } from "../../../components/ui/SlidingTabPanel";
import { planArrival, type Arrival, type ArrivalPlan } from "../arrival";
import { linkedCardId, phaseItems, type PhaseItem } from "../journey";
import type { OnboardingPathEndpoint } from "../types";
import type { LoadingState } from "./usePathLoading";

type NavigationState = { focusQuestionId?: string; choosePhase?: boolean } | null;

/**
 * What this visit was sent here for: a step in the address, a question or the phase chooser in the
 * router's state, or a link from the buddy (`?step=`, `?question=`, `?phase=`).
 *
 * Links are in the URL rather than router state because the model writes them into text the hire can
 * copy, keep or open in a second tab, and state survives none of that. `&open=1` beside `?step=`
 * unfolds the step as well as finding it -- what a card's "Back to" on the board sends.
 */
function useArrivalTarget() {
  const location = useLocation();
  const { stepId: routeStepId } = useParams<{ stepId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = location.state as NavigationState;
  const focusQuestionId = state?.focusQuestionId;
  const wantsChooser = Boolean(state?.choosePhase);

  const arrival = useMemo((): Arrival => {
    if (routeStepId) return { kind: "step", id: routeStepId };
    if (focusQuestionId) return { kind: "question", id: focusQuestionId };
    if (wantsChooser) return { kind: "choose", id: "" };
    const step = searchParams.get("step");
    if (step) return { kind: "link-step", id: step };
    const question = searchParams.get("question");
    if (question) return { kind: "link-question", id: question };
    const phase = searchParams.get("phase");
    return phase ? { kind: "link-phase", id: phase } : null;
  }, [focusQuestionId, routeStepId, searchParams, wantsChooser]);

  // A link carries the navigation's key as well: the hire who scrolled away and clicks the same link
  // in the conversation again should land again.
  const arrivalKey = arrival
    ? `${arrival.kind}:${arrival.id}${arrival.kind.startsWith("link") ? `:${location.key}` : ""}`
    : "";

  // Takes a handled link out of the address, so a reload or the hire's own next click decides what
  // they are looking at rather than the link lighting the same card up again.
  const clearLink = useCallback(
    () =>
      setSearchParams(
        (params) => {
          for (const name of ["step", "question", "phase", "open"]) params.delete(name);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  return { arrival, arrivalKey, linkOpensStep: searchParams.get("open") === "1", clearLink };
}

/**
 * The item a buddy link landed on, for as long as its light plays. `key` changes per arrival, so
 * following the same link again scrolls to it again. Cleared when the light has played or the member
 * moves to another phase, so neither the scroll nor the light comes back on its own later.
 *
 * A link followed from the graph switches to the list, which `SlidingTabPanel` mounts only after the
 * graph has slid out -- so a card that is not there yet is looked for again once it can be.
 */
function useLinkHighlight(loadingState: LoadingState, selectedPhaseId: string, viewMode: string) {
  const [highlight, setHighlight] = useState<{ id: string; key: string } | null>(null);
  const clearHighlight = useCallback(() => setHighlight(null), []);
  const scrolledRef = useRef("");

  useEffect(() => {
    if (loadingState !== "success" || !highlight) return;
    if (scrolledRef.current === highlight.key) return;
    const scroll = () => {
      const card = document.getElementById(linkedCardId(highlight.id));
      if (!card) return false;
      scrolledRef.current = highlight.key;
      card.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return true;
    };
    if (scroll()) return;
    const timer = window.setTimeout(scroll, SLIDING_PANEL_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight, loadingState, selectedPhaseId, viewMode]);

  return { highlight, setHighlight, clearHighlight };
}

/**
 * Scrolls to an item the page opened on the member's behalf -- a link, "up next", "continue" -- once
 * it is the one unfolded. `scrollWhenOpened` names the item to scroll to.
 */
export function useScrollToOpened(
  initial: string | null,
  expandedItemId: string | null,
  loadingState: LoadingState,
  selectedPhaseId: string,
) {
  const targetRef = useRef<string | null>(initial);
  const scrollWhenOpened = useCallback((id: string) => {
    targetRef.current = id;
  }, []);

  useEffect(() => {
    const target = targetRef.current;
    if (loadingState !== "success" || !target || target !== expandedItemId) return;
    targetRef.current = null;
    document
      .querySelector(`[data-item-id="${target}"]`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [expandedItemId, loadingState, selectedPhaseId]);

  return scrollWhenOpened;
}

/** What an arrival changes on the page, handed in by the page that owns those pieces. */
export type ArrivalEffects = {
  showListByArrival: () => void;
  setSelectedPhaseId: (phaseId: string) => void;
  setExpandedItemId: (update: (current: string | null) => string | null) => void;
  setGraphItemId: (itemId: string | null) => void;
  scrollToChooser: () => void;
  scrollWhenOpened: (itemId: string) => void;
  /** Starts a step opened by its address, like one opened by a click. */
  startStep: (item: PhaseItem) => void;
};

type Params = {
  path: OnboardingPathEndpoint | null;
  loadingState: LoadingState;
  selectedPhaseId: string;
  viewMode: string;
  effects: ArrivalEffects;
};

/**
 * Follows what the visit was sent for, once per arrival.
 *
 * One effect rather than one per instruction, and keyed on the instruction rather than run once on
 * mount. `/onboarding` and `/onboarding/:stepId` are the same component in the same position, so a
 * second link arriving while the page is open remounts nothing -- which is how the first version came
 * to follow a changed step id but not a changed question, and to bring the chooser into view exactly
 * once per visit however often somebody was sent to it.
 */
export function useArrival({ path, loadingState, selectedPhaseId, viewMode, effects }: Params) {
  const toast = useToast();
  const navigate = useNavigate();
  const { arrival, arrivalKey, linkOpensStep, clearLink } = useArrivalTarget();
  const { highlight, setHighlight, clearHighlight } = useLinkHighlight(
    loadingState,
    selectedPhaseId,
    viewMode,
  );
  const handledRef = useRef("");

  // Read by the effect below, which must not re-run every time the page recreates one of these.
  const effectsRef = useRef(effects);
  useEffect(() => {
    effectsRef.current = effects;
  });

  useEffect(() => {
    if (loadingState !== "success" || !path || !arrival) return;
    if (handledRef.current === arrivalKey) return;
    handledRef.current = arrivalKey;
    const plan = planArrival(arrival, path, linkOpensStep);

    // Deferred to a microtask: React 19's lint rejects a synchronous setState in an effect body.
    queueMicrotask(() => {
      const apply = effectsRef.current;
      // The list, whichever view was last used: a step, a question and the chooser all unfold there.
      apply.showListByArrival();
      // A link is followed in the list, so a step left open on the graph is let go of too --
      // otherwise swiping stayed off and the graph reopened it on the way back.
      if (arrival.kind.startsWith("link")) apply.setGraphItemId(null);
      carryOut(plan, { apply, arrivalKey, setHighlight, clearLink, toast, navigate });
    });
  }, [
    arrival,
    arrivalKey,
    clearLink,
    linkOpensStep,
    loadingState,
    navigate,
    path,
    setHighlight,
    toast,
  ]);

  return { linkHighlight: highlight, clearLinkHighlight: clearHighlight };
}

type Doing = {
  apply: ArrivalEffects;
  arrivalKey: string;
  setHighlight: (highlight: { id: string; key: string }) => void;
  clearLink: () => void;
  toast: ReturnType<typeof useToast>;
  navigate: ReturnType<typeof useNavigate>;
};

function carryOut(plan: ArrivalPlan, doing: Doing): void {
  const { apply } = doing;
  switch (plan.type) {
    case "chooser":
      apply.setExpandedItemId(() => null);
      apply.scrollToChooser();
      return;
    case "missing":
      doing.toast.error(plan.message, {
        description: "It may have been replaced when your path was rebuilt.",
      });
      // Only a step has an address of its own to go back from; a question arrives in router state,
      // which is dropped by navigating to the same place without it.
      if (plan.link) doing.clearLink();
      else void doing.navigate("/onboarding", { replace: true, state: null });
      return;
    case "phase":
      apply.setSelectedPhaseId(plan.phase.id);
      // An item open in the linked phase stays open: it may hold a typed answer.
      apply.setExpandedItemId((current) =>
        phaseItems(plan.phase).some((item) => item.id === current) ? current : null,
      );
      doing.clearLink();
      return;
    case "land":
      apply.setSelectedPhaseId(plan.phaseId);
      // "You're on #3" is most likely clicked while #3 is open -- collapsing it would throw away a
      // typed answer or skip reason. A link that asks for the step open unfolds it instead.
      if (plan.unfold) {
        apply.scrollWhenOpened(plan.itemId);
        apply.setExpandedItemId(() => plan.itemId);
      } else {
        apply.setExpandedItemId((current) => (current === plan.itemId ? current : null));
      }
      doing.setHighlight({ id: plan.itemId, key: doing.arrivalKey });
      doing.clearLink();
      return;
    case "open":
      apply.setSelectedPhaseId(plan.phaseId);
      apply.scrollWhenOpened(plan.item.id);
      apply.setExpandedItemId(() => plan.item.id);
      // A step opened by its address is started like one opened by a click -- including the second
      // link of a visit, which the load-time version could not see.
      apply.startStep(plan.item);
  }
}
