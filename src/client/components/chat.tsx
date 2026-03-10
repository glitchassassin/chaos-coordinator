import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { instanceUrl } from "../hooks/use-api.js";
import { Message } from "./message.js";
import { PermissionBanner } from "./permission-banner.js";
import { QuestionBanner } from "./question-banner.js";
import { useSSE } from "../hooks/use-sse.js";
import { summarizePatch } from "../util/diff.js";
import type { MessageWithParts, SSEEvent, PermissionRequest, QuestionRequest, Session } from "../types.js";

interface Props {
  instanceId: string;
  sessionId: string;
  session: Session | null;
  messages: MessageWithParts[];
  snapshotEnabled: boolean;
  onForkSession: (messageId: string) => void | Promise<void>;
  onRevertMessage: (messageId: string) => void | Promise<void>;
  onUnrevertSession: () => void | Promise<void>;
}

function RevertBoundary({
  count,
  diff,
  onUnrevert,
}: {
  count: number;
  diff: string | undefined;
  onUnrevert: () => void | Promise<void>;
}) {
  const files = diff ? summarizePatch(diff) : [];
  return (
    <div class="revert-boundary">
      <div class="revert-boundary-header">
        <div>
          <div class="revert-boundary-title">{count} message{count === 1 ? "" : "s"} reverted</div>
          <div class="revert-boundary-text">Continue from this point or restore the hidden messages.</div>
        </div>
        <button
          class="btn revert-boundary-btn revert-boundary-btn--icon"
          onClick={() => void onUnrevert()}
          aria-label="Restore reverted messages"
          title="Restore reverted messages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M13,18V6L21.5,12L13,18M2.5,18V6L11,12L2.5,18Z" />
          </svg>
        </button>
      </div>
      {files.length > 0 && (
        <div class="revert-boundary-files">
          {files.map((file) => (
            <div key={file.path} class="revert-boundary-file">
              <span>{file.path}</span>
              <span>
                {file.additions > 0 && ` +${file.additions}`}
                {file.deletions > 0 && ` -${file.deletions}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Chat({
  instanceId,
  sessionId,
  session,
  messages,
  snapshotEnabled,
  onForkSession,
  onRevertMessage,
  onUnrevertSession,
}: Props) {
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<QuestionRequest[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  // Fetch pending permissions on mount / session switch
  useEffect(() => {
    fetch(instanceUrl(instanceId, "/permission"))
      .then((res) => (res.ok ? res.json() : []))
      .then((all: PermissionRequest[]) => {
        setPendingPermissions(all.filter((p) => p.sessionID === sessionId));
      })
      .catch(() => setPendingPermissions([]));
  }, [instanceId, sessionId]);

  // Fetch pending questions on mount / session switch
  useEffect(() => {
    fetch(instanceUrl(instanceId, "/question"))
      .then((res) => (res.ok ? res.json() : []))
      .then((all: QuestionRequest[]) => {
        setPendingQuestions(all.filter((q) => q.sessionID === sessionId));
      })
      .catch(() => setPendingQuestions([]));
  }, [instanceId, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // SSE event handler — filter to current session
  const handleEvent = useCallback(
    (evt: SSEEvent, _instanceId: string) => {
      const props = evt.properties;

      if (evt.type === "permission.asked") {
        const perm = props as unknown as PermissionRequest;
        if (perm.sessionID !== sessionId) return;
        setPendingPermissions((prev) =>
          prev.some((p) => p.id === perm.id) ? prev : [...prev, perm],
        );
      }

      if (evt.type === "permission.replied") {
        const { requestID } = props as { sessionID: string; requestID: string };
        setPendingPermissions((prev) => prev.filter((p) => p.id !== requestID));
      }

      if (evt.type === "question.asked") {
        const req = props as unknown as QuestionRequest;
        if (req.sessionID !== sessionId) return;
        setPendingQuestions((prev) =>
          prev.some((q) => q.id === req.id) ? prev : [...prev, req],
        );
      }

      if (evt.type === "question.replied" || evt.type === "question.rejected") {
        const { requestID } = props as { sessionID: string; requestID: string };
        setPendingQuestions((prev) => prev.filter((q) => q.id !== requestID));
      }

    },
    [sessionId],
  );

  useSSE([instanceId], handleEvent);

  const replyPermission = useCallback(
    async (requestId: string, reply: "once" | "always" | "reject") => {
      // Optimistically remove
      setPendingPermissions((prev) => prev.filter((p) => p.id !== requestId));
      try {
        await fetch(
          instanceUrl(instanceId, `/permission/${requestId}/reply`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reply }),
          },
        );
      } catch {
        // If the request fails, re-fetch to restore accurate state
        fetch(instanceUrl(instanceId, "/permission"))
          .then((res) => (res.ok ? res.json() : []))
          .then((all: PermissionRequest[]) => {
            setPendingPermissions(all.filter((p) => p.sessionID === sessionId));
          })
          .catch(() => {});
      }
    },
    [instanceId, sessionId],
  );

  const replyQuestion = useCallback(
    async (requestId: string, answers: string[][]) => {
      setPendingQuestions((prev) => prev.filter((q) => q.id !== requestId));
      try {
        await fetch(instanceUrl(instanceId, `/question/${requestId}/reply`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
      } catch {
        fetch(instanceUrl(instanceId, "/question"))
          .then((res) => (res.ok ? res.json() : []))
          .then((all: QuestionRequest[]) => {
            setPendingQuestions(all.filter((q) => q.sessionID === sessionId));
          })
          .catch(() => {});
      }
    },
    [instanceId, sessionId],
  );

  const rejectQuestion = useCallback(
    async (requestId: string) => {
      setPendingQuestions((prev) => prev.filter((q) => q.id !== requestId));
      try {
        await fetch(instanceUrl(instanceId, `/question/${requestId}/reject`), {
          method: "POST",
        });
      } catch {
        // best-effort; SSE will update state if needed
      }
    },
    [instanceId],
  );

  const revertMessageId = session?.revert?.messageID;
  const revertIndex = revertMessageId ? messages.findIndex((message) => message.info.id === revertMessageId) : -1;
  const visibleMessages = revertIndex >= 0 ? messages.slice(0, revertIndex) : messages;
  const revertedCount =
    revertIndex >= 0
      ? messages.slice(revertIndex).filter((message) => message.info.role === "user").length
      : 0;

  return (
    <div class="chat-container">
      <div class="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div class="empty-state">No messages yet. Start a conversation.</div>
        )}
        {visibleMessages.map((m, i) => (
          <Message
            key={m.info.id}
            role={m.info.role}
            parts={m.parts}
            info={m.info}
            showRole={i === 0 || visibleMessages[i - 1].info.role !== m.info.role}
            onFork={m.info.role === "user" ? () => onForkSession(m.info.id) : undefined}
            onRevert={snapshotEnabled && m.info.role === "user" ? () => onRevertMessage(m.info.id) : undefined}
          />
        ))}
        {revertIndex >= 0 && (
          <RevertBoundary
            count={revertedCount}
            diff={session?.revert?.diff}
            onUnrevert={onUnrevertSession}
          />
        )}
        <QuestionBanner questions={pendingQuestions} onReply={replyQuestion} onReject={rejectQuestion} />
      </div>
      <PermissionBanner permissions={pendingPermissions} onReply={replyPermission} />
    </div>
  );
}
