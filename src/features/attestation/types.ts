/** Where a request for somebody to confirm a hire's work has got to. */
export type AttestationState = "REQUESTED" | "ACCEPTED" | "WITHDRAWN";

/**
 * One request for a named colleague to confirm a hire's work.
 *
 * `returnedCount` is shown rather than hidden: work that took three passes is not the same as work
 * that took none, and the autonomy milestone reads exactly this number.
 */
export interface Attestation {
  id: string;
  hireId: string;
  hireName: string | null;
  projectId: string;
  title: string;
  evidenceUrl: string | null;
  attesterId: string;
  attesterName: string | null;
  state: AttestationState;
  requestedAt: string;
  firstResponseAt: string | null;
  acceptedAt: string | null;
  returnedCount: number;
  returnReason: string | null;
}
