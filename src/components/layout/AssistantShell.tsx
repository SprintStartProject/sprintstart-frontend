import { useCallback } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { SlidingTabPanel } from "../ui/SlidingTabPanel";
import { useSwipeableTabs } from "../../hooks/useHorizontalWheelNavigation";
import { AssistantSurfaceSwitch } from "../common/AssistantSurfaceSwitch";
import { BuddyNewChatAction } from "../../features/buddy/components/BuddyNewChatAction";
import {
  ASSISTANT_SURFACES,
  ASSISTANT_SURFACE_ROUTES,
  type AssistantSurface,
} from "../common/assistantSurfaces";

/**
 * What each half of the assistant is for. The title stays put — it names the pair — and this
 * is the line that says which of them you are looking at.
 */
const SURFACE_SUBTITLES: Record<AssistantSurface, string> = {
  chat: "Ask questions about project knowledge, code, documentation and onboarding.",
  buddy: "Your onboarding mentor — here whenever you're stuck.",
};

/**
 * The frame the chat and the buddy share: one page header with the switch in it, and whichever
 * of the two conversations is open underneath.
 *
 * A **layout route**, not a component either page renders. That is the whole mechanism: React
 * Router keeps a layout element mounted while its child routes change, so the header does not
 * blink and re-mount on the way across, and the panel below can animate between two things
 * rather than being replaced wholesale. Two sibling pages each drawing their own copy of the
 * header could only ever cut.
 *
 * The header is the same band every other page uses — `app-page-frame` gutters, `py-6`,
 * `PageHeader` — so the assistant's title starts on the line the dashboard's and the knowledge
 * base's do. That was the point of the change: the two conversations stopped looking like two
 * loose full-screen surfaces and became a page of the app with a switch on it.
 *
 * `useOutlet()` rather than `<Outlet />`, and this matters. `<Outlet />` resolves against
 * whatever the *current* route context says, so the panel `AnimatePresence` is holding on
 * screen to animate out would re-render as the page being navigated *to* — the outgoing half
 * of the slide would show the incoming content. `useOutlet()` hands back a finished element
 * with its route context already baked in, which is a thing that can be kept.
 */
export function AssistantShell() {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The route is the truth; `/chat/:id` is still the chat.
  const surface: AssistantSurface = pathname.startsWith("/buddy") ? "buddy" : "chat";

  const goToSurface = useCallback(
    (next: AssistantSurface) => void navigate(ASSISTANT_SURFACE_ROUTES[next]),
    [navigate],
  );

  // Two-finger horizontal swipe, the same gesture the admin, knowledge base and team pages
  // answer to. On the content rather than the whole shell, so a flick over the header — where
  // the switch itself is — is left alone.
  const swipeRef = useSwipeableTabs<AssistantSurface, HTMLDivElement>({
    order: ASSISTANT_SURFACES,
    value: surface,
    onChange: goToSurface,
  });

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-app-bg lg:h-screen">
      <header className="shrink-0 border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Sparkles}
            title="AI Assistant"
            subtitle={SURFACE_SUBTITLES[surface]}
            // The subtitle is the only thing on this header that changes, and on a phone it is
            // the line with the least to say — so it is also the one that makes room for the
            // switch rather than pushing the conversation further down.
            hideSubtitleBelow="md"
            actions={
              <>
                {/* Page-level actions belong beside the switch, the way "Edit dashboard" sits
                    beside the dashboard's title. Mounted only for the half it belongs to —
                    which is also what keeps the chat from subscribing to a conversation that
                    streams in the corner window of every other page. */}
                {surface === "buddy" && <BuddyNewChatAction />}
                <AssistantSurfaceSwitch current={surface} />
              </>
            }
          />
        </div>
      </header>

      <div ref={swipeRef} className="flex min-h-0 flex-1 flex-col">
        <SlidingTabPanel
          activeKey={surface}
          index={ASSISTANT_SURFACES.indexOf(surface)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {outlet}
        </SlidingTabPanel>
      </div>
    </div>
  );
}
