import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, BookCheck, FolderKanban, Inbox } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SegmentedTabs, type SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { SlidingTabPanel } from "../../../components/ui/SlidingTabPanel";
import { Spinner } from "../../../components/ui/Spinner";
import { useAuth } from "../../../context/useAuth";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { PermissionGroup } from "../../../services/types";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { queryKeys } from "../../../services/queryKeys";
import { PmSectionHeader } from "../../pm-area/components/PmCard";
import { INBOX_VIEW_PARAM } from "../../pm-area/pmWorkspacePaths";
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
 * Lives in the PM workspace as its own section (it used to be a sidebar entry and a page of its
 * own). Per-project, since escalations belong to a project; a switcher scopes it. Empty states separate
 * "no project" from "inbox clear" — a clear inbox is a good state, not a missing one.
 */
export function KnowledgeRequestInboxPage() {
  const { profile } = useAuth();
  const canWrite =
    profile?.permissionGroup === PermissionGroup.PM ||
    profile?.permissionGroup === PermissionGroup.ADMIN;

  const { projects, selectedProjectId, isLoading: projectsLoading } = useProjectContext();

  // In the URL, so the PM workspace's swipe can move between the two views like between
  // sections.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get(INBOX_VIEW_PARAM) === "answered" ? "answered" : "open";
  const setTab = (next: Tab) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === "answered") params.set(INBOX_VIEW_PARAM, "answered");
        else params.delete(INBOX_VIEW_PARAM);
        return params;
      },
      { replace: true },
    );

  const {
    data: openRequests,
    loading: openLoading,
    error: openError,
    refetch: refetchOpen,
  } = useQueryFetch(queryKeys.knowledgeRequest.open(selectedProjectId), () =>
    selectedProjectId ? knowledgeRequestService.listOpen(selectedProjectId) : Promise.resolve([]),
  );

  const {
    data: answers,
    loading: answersLoading,
    error: answersError,
    refetch: refetchAnswers,
  } = useQueryFetch(queryKeys.knowledgeRequest.answers(selectedProjectId), () =>
    selectedProjectId
      ? knowledgeRequestService.listAnswers(selectedProjectId)
      : Promise.resolve([]),
  );

  // After any mutation, so both lists reload against the server, keeping the queue and the
  // durable-answers view honest (an answered request leaves the queue and appears as knowledge).
  const reload = () => {
    refetchOpen();
    refetchAnswers();
  };

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
  const tabOptions: SegmentedTabOption<Tab>[] = useMemo(
    () => [
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
    ],
    [openLoading, openCount, answersLoading, answeredCount],
  );

  return (
    // A section of the PM workspace, which owns the page header and the section-level swipe.
    // The open/answered switch sits in this section's own header row rather than as a second
    // pill bar under the workspace's.
    <div>
      <PmSectionHeader
        title="Escalations"
        description="Questions the buddy could not answer. Answer one and it becomes durable knowledge."
        actions={
          <SegmentedTabs
            value={tab}
            options={tabOptions}
            onChange={setTab}
            layoutId="knowledge-request-inbox-tab-pill"
            ariaLabel="Inbox views"
          />
        }
      />

      <div className="space-y-6">
        {!projectsLoading && projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8 text-app-text-disabled" />}
            title="No projects"
          >
            There are no projects with an escalation inbox yet.
          </EmptyState>
        ) : (
          <>
            {/* Directional slide matches the sibling pages' tab panels; the key/index pair
                derives travel direction from the tab order.
                tabIndex must be ≥ 0 — TAB_ORDER must stay in sync with the Tab type, or
                indexOf returns -1 and SlidingTabPanel's direction calculation breaks. */}
            <SlidingTabPanel activeKey={tab} index={TAB_ORDER.indexOf(tab)}>
              {tab === "open" ? (
                <View
                  loading={openLoading}
                  loadingLabel="Loading open escalations"
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
                  loadingLabel="Loading durable answers"
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
      </div>
    </div>
  );
}

function View({
  loading,
  loadingLabel,
  error,
  isEmpty,
  empty,
  children,
}: {
  loading: boolean;
  /** What the spinner announces — both tabs share this helper, so naming the
   *  list being fetched is the caller's job. */
  loadingLabel: string;
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
        <Spinner size="lg" label={loadingLabel} />
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
