import { useMemo, useState } from "react";
import { AlertCircle, BookCheck, FolderKanban, Inbox } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../../components/ui/SlidingTabPanel";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuth } from "../../../context/useAuth";
import { useFetch } from "../../../hooks/useFetch";
import { PermissionGroup } from "../../../services/types";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { useProjectContext } from "../../projects/useProjectContext";
import { RequestCard } from "./RequestCard";
import { CanonicalAnswerCard } from "./CanonicalAnswerCard";

type Tab = "open" | "answered";

const TAB_ORDER: Tab[] = ["open", "answered"];

/**
 * The PM side of the buddy's growth loop: the escalation inbox. A hire flags a question the buddy
 * could not answer; here a PM answers it — minting a durable answer the buddy then serves — or
 * dismisses a one-off. The "Durable answers" tab shows the knowledge that has accumulated, editable
 * when reality changes. PM/HR read; only PM/ADMIN write (enforced server-side too).
 *
 * Per-project, since escalations belong to a project; a switcher scopes it. Empty states separate
 * "no project" from "inbox clear" — a clear inbox is a good state, not a missing one.
 */
export function KnowledgeRequestInboxPage() {
  const { profile } = useAuth();
  const canWrite =
    profile?.permissionGroup === PermissionGroup.PM ||
    profile?.permissionGroup === PermissionGroup.ADMIN;

  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();

  const [tab, setTab] = useState<Tab>("open");
  // Bumped after any mutation so both lists reload against the server, keeping the queue and the
  // durable-answers view honest (an answered request leaves the queue and appears as knowledge).
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((key) => key + 1);

  const {
    data: openRequests,
    loading: openLoading,
    error: openError,
  } = useFetch(
    () =>
      selectedProjectId ? knowledgeRequestService.listOpen(selectedProjectId) : Promise.resolve([]),
    [selectedProjectId, refreshKey],
  );

  const {
    data: answers,
    loading: answersLoading,
    error: answersError,
  } = useFetch(
    () =>
      selectedProjectId
        ? knowledgeRequestService.listAnswers(selectedProjectId)
        : Promise.resolve([]),
    [selectedProjectId, refreshKey],
  );

  // Longest-waiting first — the backend orders this way, but sorting here keeps it true if a
  // future caller doesn't. Oldest createdAt = waited longest.
  const orderedOpen = useMemo(
    () =>
      [...(openRequests ?? [])].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [openRequests],
  );

  const orderedAnswers = useMemo(
    () =>
      [...(answers ?? [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [answers],
  );

  const handleAnswer = async (requestId: string, answer: string, question: string) => {
    await knowledgeRequestService.answer(requestId, answer, question);
    reload();
  };

  const handleDismiss = async (requestId: string) => {
    await knowledgeRequestService.dismiss(requestId);
    reload();
  };

  const handleEdit = async (answerId: string, question: string, answer: string) => {
    await knowledgeRequestService.editAnswer(answerId, question, answer);
    reload();
  };

  const openCount = orderedOpen.length;
  const answeredCount = orderedAnswers.length;

  // Counts stay undefined while their list is loading, so the pill doesn't flash a stale "0".
  const TAB_OPTIONS: SegmentedTabOption<Tab>[] = [
    {
      value: "open",
      label: "Open",
      icon: <Inbox className="h-4 w-4" aria-hidden="true" />,
      count: openLoading ? undefined : openCount,
    },
    {
      value: "answered",
      label: "Durable answers",
      icon: <BookCheck className="h-4 w-4" aria-hidden="true" />,
      count: answersLoading ? undefined : answeredCount,
    },
  ];

  return (
    // No root background: the app-wide aurora and cursor-glow canvas sit behind
    // every route, and painting `bg-app-bg` here would hide them — the same
    // choice the dashboard and PM dashboard make. Only the header band and the
    // cards carry their own surfaces.
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={Inbox}
            title="Escalation inbox"
            subtitle="Questions the buddy could not answer, sent to a person. Answer one once and it becomes durable knowledge the buddy serves to everyone after."
          />
        </div>
      </header>

      <main className="app-page-frame space-y-6 py-6 lg:py-8">
        {!projectsLoading && projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8 text-app-text-disabled" />}
            title="No projects"
          >
            There are no projects with an escalation inbox yet.
          </EmptyState>
        ) : (
          <>
            {/* The app's shared segmented control rather than a tab bar of this page's own —
                same reason ArrivalStepsPage cites: the sliding pill and hover magnify are the
                house look for switching sections, so the inbox shouldn't grow a second one. */}
            <SegmentedTabs
              value={tab}
              options={TAB_OPTIONS}
              onChange={setTab}
              layoutId="knowledge-request-inbox-tab-pill"
              ariaLabel="Inbox views"
            />

            {/* Directional slide matches the sibling pages' tab panels; the key/index pair
                derives travel direction from the tab order.
                tabIndex must be ≥ 0 — TAB_ORDER must stay in sync with the Tab type, or
                indexOf returns -1 and SlidingTabPanel's direction calculation breaks. */}
            <SlidingTabPanel activeKey={tab} index={TAB_ORDER.indexOf(tab)}>
              {tab === "open" ? (
                <View
                  loading={openLoading}
                  error={openError}
                  isEmpty={openCount === 0}
                  empty={
                    <EmptyState
                      icon={<Inbox className="h-8 w-8 text-app-success-solid" />}
                      title="Inbox clear"
                    >
                      No open escalations. When the buddy can&apos;t answer something and a hire
                      flags it, it lands here.
                    </EmptyState>
                  }
                >
                  <ul className="space-y-3">
                    {orderedOpen.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        onAnswer={handleAnswer}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </ul>
                </View>
              ) : (
                <View
                  loading={answersLoading}
                  error={answersError}
                  isEmpty={answeredCount === 0}
                  empty={
                    <EmptyState
                      icon={<BookCheck className="h-8 w-8 text-app-text-disabled" />}
                      title="No durable answers yet"
                    >
                      Answers you give in the inbox collect here — the growing body of knowledge the
                      buddy serves.
                    </EmptyState>
                  }
                >
                  {!canWrite && (
                    <p className="mb-3 text-sm text-app-text-muted">
                      You can read these; editing is a PM action.
                    </p>
                  )}
                  <ul className="space-y-3">
                    {orderedAnswers.map((answer) => (
                      <CanonicalAnswerCard
                        key={answer.id}
                        answer={answer}
                        onSave={handleEdit}
                        readOnly={!canWrite}
                      />
                    ))}
                  </ul>
                </View>
              )}
            </SlidingTabPanel>
          </>
        )}
      </main>
    </div>
  );
}

function View({
  loading,
  error,
  isEmpty,
  empty,
  children,
}: {
  loading: boolean;
  error: boolean;
  isEmpty: boolean;
  empty: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) {
    // The shared Spinner announces the wait (role="status") — the raw Loader2
    // this replaces left screen readers silent while the page waited.
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Loading escalations" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
        title="Couldn't load this"
      >
        Try again shortly.
      </EmptyState>
    );
  }
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
