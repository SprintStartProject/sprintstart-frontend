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
};
