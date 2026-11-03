import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import { readSeenReplyIds, writeSeenReplyIds } from "./railPreference";

type PmRepliesDrawer = {
  isOpen: boolean;
  close: () => void;
  open: () => void;
  unseenCount: number;
};

/**
 * The PM drawer's own state, and the ids the header badge has already been told about. Per user,
 * because whether an answer has been seen is per person — a shared browser must not let one hire's
 * read mark another's answer as seen.
 */
export function usePmRepliesDrawer(answered: { id: string }[]): PmRepliesDrawer {
  const { profile } = useAuth();
  const userId = profile?.id ?? "anonymous";
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>(() => readSeenReplyIds(userId));
  const unseenCount = answered.filter((request) => !seenIds.includes(request.id)).length;

  // Opening is reading: everything answered so far is marked seen, so the badge answers "is there
  // something I have not looked at?" rather than "has a PM ever answered me?".
  const open = () => {
    setIsOpen(true);
    const answeredIds = answered.map((request) => request.id);
    setSeenIds(answeredIds);
    writeSeenReplyIds(userId, answeredIds);
  };

  return { isOpen, close: () => setIsOpen(false), open, unseenCount };
}
