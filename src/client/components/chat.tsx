import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { instanceUrl } from "../hooks/use-api.js";
import { Message } from "./message.js";
import { PermissionBanner } from "./permission-banner.js";
import { QuestionBanner } from "./question-banner.js";
import { useSSE } from "../hooks/use-sse.js";
import type { MessageWithParts, SSEEvent, PermissionRequest, QuestionRequest } from "../types.js";

interface Props {
  instanceId: string;
  sessionId: string;
  messages: MessageWithParts[];
}

export function Chat({ instanceId, sessionId, messages }: Props) {
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

  return (
    <div class="chat-container">
      <div class="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div class="empty-state">No messages yet. Start a conversation.</div>
        )}
        {messages.map((m, i) => (
          <Message
            key={m.info.id}
            role={m.info.role}
            parts={m.parts}
            info={m.info}
            showRole={i === 0 || messages[i - 1].info.role !== m.info.role}
          />
        ))}
        <QuestionBanner questions={pendingQuestions} onReply={replyQuestion} onReject={rejectQuestion} />
      </div>
      <PermissionBanner permissions={pendingPermissions} onReply={replyPermission} />
    </div>
  );
}
