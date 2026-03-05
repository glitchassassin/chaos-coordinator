import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { Message } from "./message.js";
import { PermissionBanner } from "./permission-banner.js";
import { QuestionBanner } from "./question-banner.js";
import { instanceUrl } from "../hooks/use-api.js";
import { useSSE } from "../hooks/use-sse.js";
import type { MessageWithParts, Part, SSEEvent, MessageInfo, PermissionRequest, QuestionRequest } from "../types.js";

interface Props {
  instanceId: string;
  sessionId: string;
  initialMessages: MessageWithParts[];
  onSend: (text: string) => Promise<void>;
}

export function Chat({ instanceId, sessionId, initialMessages, onSend }: Props) {
  const [messages, setMessages] = useState<MessageWithParts[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<QuestionRequest[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  // Sync when parent passes new initial messages (session switch)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

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

      if (evt.type === "message.updated") {
        const info = props.info as MessageInfo;
        if (info.sessionID !== sessionId) return;
        if (info.role === "assistant" && info.time.completed) {
          setSending(false);
        }
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.info.id === info.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], info };
            return updated;
          }
          // New message — drop any optimistic placeholder for this role
          if (info.role === "user") {
            const without = prev.filter((m) => !m.info.id.startsWith("pending-"));
            return [...without, { info, parts: [] }];
          }
          return [...prev, { info, parts: [] }];
        });
      }

      if (evt.type === "message.part.updated") {
        const part = props.part as Part;
        if (part.sessionID !== sessionId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.info.id !== part.messageID) return m;
            const parts = [...m.parts];
            const idx = parts.findIndex((p) => p.id === part.id);
            if (idx >= 0) {
              parts[idx] = part;
            } else {
              parts.push(part);
            }
            return { ...m, parts };
          }),
        );
      }

      if (evt.type === "message.part.delta") {
        const { sessionID, messageID, partID, delta } = props as {
          sessionID: string;
          messageID: string;
          partID: string;
          field: string;
          delta: string;
        };
        if (sessionID !== sessionId) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.info.id !== messageID) return m;
            const parts = m.parts.map((p) => {
              if (p.id !== partID) return p;
              if (p.type === "text") {
                return { ...p, text: (p.text || "") + delta };
              }
              return p;
            });
            return { ...m, parts };
          }),
        );
      }

      if (evt.type === "message.removed") {
        const { sessionID, messageID } = props as {
          sessionID: string;
          messageID: string;
        };
        if (sessionID !== sessionId) return;
        setMessages((prev) => prev.filter((m) => m.info.id !== messageID));
      }

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

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    // Optimistic add
    const optimistic: MessageWithParts = {
      info: {
        id: `pending-${Date.now()}`,
        sessionID: sessionId,
        role: "user",
        time: { created: Date.now() },
      },
      parts: [
        {
          id: `part-pending-${Date.now()}`,
          sessionID: sessionId,
          messageID: `pending-${Date.now()}`,
          type: "text",
          text,
        },
      ],
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await onSend(text);
    } catch {
      setSending(false);
    }
  };

  const handleStop = useCallback(async () => {
    await fetch(instanceUrl(instanceId, `/session/${sessionId}/abort`), { method: "POST" });
  }, [instanceId, sessionId]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
            showRole={i === 0 || messages[i - 1].info.role !== m.info.role}
          />
        ))}
        <QuestionBanner questions={pendingQuestions} onReply={replyQuestion} onReject={rejectQuestion} />
      </div>
      <PermissionBanner permissions={pendingPermissions} onReply={replyPermission} />
      <form class="input-area" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <textarea
          value={input}
          onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={sending ? "Sending..." : "Type a message..."}
          disabled={sending}
          rows={2}
        />
        <button
          type="button"
          class="btn btn-icon"
          disabled={!sending}
          onClick={handleStop}
          aria-label="Stop"
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M9,9H15V15H9" />
          </svg>
        </button>
        <button type="submit" class="btn btn-icon" disabled={sending} aria-label="Send">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15,20H9V12H4.16L12,4.16L19.84,12H15V20Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
