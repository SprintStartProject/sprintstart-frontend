/**
 * The buddy's growth loop, frontend side: a hire escalates a question the buddy could not answer,
 * a PM answers it, and the answer becomes durable knowledge the buddy serves next time.
 */
export type KnowledgeRequestStatus = "OPEN" | "ANSWERED" | "DISMISSED";

/** A human's durable answer, promoted into buddy knowledge. */
export type CanonicalAnswer = {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Who asked, and where they are — so a PM can answer without going to look them up.
 *
 * Served on the PM queue only. A hire reading their own escalations already knows who they are,
 * and this carries a name and a progress figure nobody outside the project should see.
 */
export type EscalationHire = {
  userId: string;
  displayName: string;
  profileIcon: string | null;
  currentPhase: string | null;
  currentStep: string | null;
  /** 0 to 1, not a percentage — the backend's own scale. */
  progressPercentage: number;
};

/** One escalated question, as the PM inbox and the hire's own view see it. */
export type KnowledgeRequest = {
  id: string;
  projectId: string;
  hireId: string;
  question: string;
  status: KnowledgeRequestStatus;
  createdAt: string;
  answeredAt: string | null;
  answer: CanonicalAnswer | null;
  /**
   * Null on a hire's own view, and null on the queue when the asker's user record can no longer be
   * resolved — a question whose author has gone is still a question somebody is waiting on.
   */
  hire: EscalationHire | null;
};
