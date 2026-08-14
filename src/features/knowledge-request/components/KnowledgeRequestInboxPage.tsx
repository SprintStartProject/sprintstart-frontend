import { useMemo, useState } from "react";
import { AlertCircle, BookCheck, FolderKanban, Inbox, Loader2 } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { useAuth } from "../../../context/useAuth";
import { useFetch } from "../../../hooks/useFetch";
import { PermissionGroup } from "../../../services/types";
import { knowledgeRequestService } from "../../../services/knowledgeRequestService";
import { useProjectContext } from "../../projects/useProjectContext";
import { RequestCard } from "./RequestCard";
import { CanonicalAnswerCard } from "./CanonicalAnswerCard";

type Tab = "open" | "answered";

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

  return (
    <div className="min-h-screen bg-app-bg">
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
            body="There are no projects with an escalation inbox yet."
          />
        ) : (
          <>
            <nav className="flex gap-1 border-b border-app-border" aria-label="Inbox views">
              <TabButton
                active={tab === "open"}
                onClick={() => setTab("open")}
                icon={<Inbox className="h-4 w-4" aria-hidden="true" />}
                label="Open"
                count={openLoading ? undefined : openCount}
              />
              <TabButton
                active={tab === "answered"}
                onClick={() => setTab("answered")}
                icon={<BookCheck className="h-4 w-4" aria-hidden="true" />}
                label="Durable answers"
                count={answersLoading ? undefined : answeredCount}
              />
            </nav>

            {tab === "open" ? (
              <View
                loading={openLoading}
                error={openError}
                isEmpty={openCount === 0}
                empty={
                  <EmptyState
                    icon={<Inbox className="h-8 w-8 text-app-success-solid" />}
                    title="Inbox clear"
                    body="No open escalations. When the buddy can't answer something and a hire flags it, it lands here."
                  />
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
                    body="Answers you give in the inbox collect here — the growing body of knowledge the buddy serves."
                  />
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
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-app-brand" aria-hidden="true" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
        title="Couldn't load this"
        body="Try again shortly."
      />
    );
  }
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        active
          ? "border-app-brand text-app-text"
          : "border-transparent text-app-text-muted hover:text-app-text"
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs ${
            active
              ? "bg-app-brand/10 text-app-brand-text"
              : "bg-app-surface-muted text-app-text-muted"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-app-border bg-app-surface p-16 text-center">
      {icon}
      <h2 className="text-lg font-semibold text-app-text">{title}</h2>
      <p className="max-w-md text-sm text-app-text-muted">{body}</p>
    </div>
  );
}
