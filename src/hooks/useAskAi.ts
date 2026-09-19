import { useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ChatContext } from "../context/ChatContext";

/**
 * Hands a prompt to the chat and takes the reader there.
 *
 * The composer is filled but **not** submitted — the same contract the
 * dashboard's quick chat and the chat's own suggestion chips already use — so a
 * mis-aimed selection costs an edit rather than a message. A fresh conversation
 * is requested explicitly (`newChat`), because a quote dragged out of one
 * document has nothing to do with whichever thread happens to be open.
 *
 * Returns `false` when there is no chat to hand it to, so a caller can leave the
 * offer out rather than navigate somewhere that cannot use it.
 */
export function useAskAi(): (prompt: string) => boolean {
  const chat = useContext(ChatContext);
  const navigate = useNavigate();

  return useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || !chat) return false;

      chat.setNewRequest(trimmed);
      void navigate("/chat", { state: { newChat: true } });

      return true;
    },
    [chat, navigate],
  );
}
