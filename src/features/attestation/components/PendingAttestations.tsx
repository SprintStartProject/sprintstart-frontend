import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Undo2, UserCheck } from "lucide-react";
import type { Attestation } from "../types";
import type { UsePendingAttestationsResult } from "../hooks/usePendingAttestations";

/**
 * The queue of work colleagues have asked this person to confirm.
 *
 * Most roles produce nothing any connected system can see, so for them this is the only path to
 * finishing onboarding at all — which makes the person answering here load-bearing rather than
 * incidental. Two things follow from that.
 *
 * Sending back needs a reason, and the UI enforces it too. "No, and I won't say why" is not
 * something the hire can act on, and this is the surface where that would otherwise be easiest.
 *
 * Nothing here grades the work. The card shows what the hire said they did and a link if there
 * is one; the judgment is the colleague's, offline, in whatever way that role's work is judged.
 *
 * Renders nothing when the queue is empty — somebody with nobody waiting on them should not be
 * shown an empty box implying they are neglecting something.
 */
export function PendingAttestations({
  pending,
  loading,
  error,
  answeringId,
  answerError,
  accept,
  sendBack,
}: UsePendingAttestationsResult) {
  if (loading || (!error && pending.length === 0)) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl border border-app-border p-2">
          <UserCheck className="h-4 w-4 text-app-brand" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-app-text">Waiting on you</h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Colleagues have asked you to confirm this work. For roles whose work no system can see,
            your answer is what lets them finish onboarding.
          </p>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-app-danger-text" />
          <p className="text-sm text-app-danger-text">
            Could not load what is waiting on you. Try again in a moment.
          </p>
        </div>
      ) : null}

      {answerError ? (
        <div className="flex items-center gap-3 rounded-xl border border-app-danger-border bg-app-danger-bg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-app-danger-text" />
          <p className="text-sm text-app-danger-text">{answerError}</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {pending.map((item) => (
          <AttestationCard
            key={item.id}
            attestation={item}
            busy={answeringId === item.id}
            onAccept={() => void accept(item.id)}
            onSendBack={(reason) => void sendBack(item.id, reason)}
          />
        ))}
      </ul>
    </section>
  );
}

function AttestationCard({
  attestation,
  busy,
  onAccept,
  onSendBack,
}: {
  attestation: Attestation;
  busy: boolean;
  onAccept: () => void;
  onSendBack: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const reasonId = `send-back-reason-${attestation.id}`;

  return (
    <li className="rounded-2xl border border-app-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-text">{attestation.title}</p>
          <p className="mt-1 text-sm text-app-text-muted">
            Asked by {attestation.hireName ?? "a teammate"}
            {attestation.returnedCount > 0
              ? ` · sent back ${attestation.returnedCount} time${attestation.returnedCount === 1 ? "" : "s"} already`
              : ""}
          </p>
          {attestation.evidenceUrl ? (
            <a
              className="mt-2 inline-flex items-center gap-1 text-sm text-app-brand hover:underline"
              href={attestation.evidenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              See the work <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-app-brand" /> : null}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-success-border bg-app-success-bg px-3 py-2 text-sm text-app-success-text disabled:opacity-60"
            disabled={busy}
            onClick={onAccept}
          >
            <CheckCircle2 className="h-4 w-4" /> Confirm
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-2 text-sm text-app-text disabled:opacity-60"
            disabled={busy}
            onClick={() => setShowReason((open) => !open)}
          >
            <Undo2 className="h-4 w-4" /> Send back
          </button>
        </div>
      </div>

      {showReason ? (
        <div className="mt-4 space-y-2">
          <label className="block text-sm text-app-text" htmlFor={reasonId}>
            What needs to change?
          </label>
          <textarea
            id={reasonId}
            className="w-full rounded-xl border border-app-border bg-app-bg p-3 text-sm text-app-text"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            // Required, not optional: a hire cannot act on "no" without a reason, and
            // this is the surface where skipping it would be easiest.
            disabled={busy || reason.trim().length === 0}
            className="rounded-xl border border-app-border px-3 py-2 text-sm text-app-text disabled:opacity-60"
            onClick={() => onSendBack(reason.trim())}
          >
            Send it back
          </button>
        </div>
      ) : null}
    </li>
  );
}
