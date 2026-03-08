import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { InstanceList } from "./components/instance-list.js";
import { SessionList } from "./components/session-list.js";
import { Chat } from "./components/chat.js";
import { GitStatus } from "./components/git-status.js";
import { Explorer } from "./components/explorer.js";
import { SessionSettings } from "./components/session-settings.js";
import { DirectoryPicker } from "./components/directory-picker.js";
import { useSSE } from "./hooks/use-sse.js";
import type { Instance, Session, MessageWithParts, SSEEvent, ModelKey, SessionStatus } from "./types.js";

type View = "main" | "new-instance";
type SessionView = "chat" | "git" | "explorer" | "settings";

function apiUrl(instanceId: string, path: string): string {
  return `/api/instances/${instanceId}${path}`;
}

export function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(
    () => sessionStorage.getItem("selectedInstance")
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(
    () => sessionStorage.getItem("selectedSession")
  );
  const [messages, setMessages] = useState<MessageWithParts[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("main");
  const [sessionView, setSessionView] = useState<SessionView>("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [whisperUrl, setWhisperUrl] = useState<string | null>(null);
  const [whisperAvailable, setWhisperAvailable] = useState(true);
  const [recording, setRecording] = useState(false);
  // sessionId -> ModelKey for per-session model overrides
  const [sessionModels, setSessionModels] = useState<Map<string, ModelKey>>(() => new Map());
  const selectedModel = selectedSession ? (sessionModels.get(selectedSession) ?? null) : null;
  // sessionId -> instanceId for unread tracking (default: all read on open)
  const [unreadSessions, setUnreadSessions] = useState<Map<string, string>>(() => new Map());
  // requestId -> { sessionId, instanceId } for pending permission tracking
  const [pendingPermissions, setPendingPermissions] = useState<Map<string, { sessionId: string; instanceId: string }>>(() => new Map());

  const selectedSessionRef = useRef<string | null>(selectedSession);
  const selectedInstanceRef = useRef<string | null>(selectedInstance);
  const sessionRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPosRef = useRef<number>(0);
  const draftRef = useRef<Map<string, string>>(new Map());
  const prevSessionRef = useRef<string | null>(selectedSession);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  // Dictation model: ephemeral transcript is spliced into baseInput at insertPos
  const baseInputRef = useRef("");
  const insertPosRef = useRef(0);
  const dictationTextRef = useRef("");
  useEffect(() => { selectedSessionRef.current = selectedSession; }, [selectedSession]);
  useEffect(() => { selectedInstanceRef.current = selectedInstance; }, [selectedInstance]);

  const loadInstances = useCallback(() => {
    fetch("/api/instances")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return [];
        }
        return r.json();
      })
      .then((list: Instance[]) => {
        setInstances(list);
        if (list.length === 0) {
          setView("new-instance");
        } else {
          // Clear restored instance if it no longer exists
          setSelectedInstance((prev) =>
            prev && list.some((i) => i.id === prev) ? prev : null
          );
        }
      })
      .catch(console.error);
  }, []);

  // Load instances
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Fetch client config (whisper URL, etc.)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.ok ? r.json() : {})
      .then((cfg: { whisperUrl?: string | null }) => {
        setWhisperUrl(cfg.whisperUrl ?? null);
      })
      .catch(() => {});
  }, []);

  // Persist selections
  useEffect(() => {
    if (selectedInstance) sessionStorage.setItem("selectedInstance", selectedInstance);
    else sessionStorage.removeItem("selectedInstance");
  }, [selectedInstance]);

  useEffect(() => {
    setBusy(false);
    setSessionView("chat");
    // Save draft for the session we're leaving, restore for the one we're entering
    const prevSession = prevSessionRef.current;
    prevSessionRef.current = selectedSession;
    setInput((currentInput) => {
      if (prevSession) draftRef.current.set(prevSession, currentInput);
      return selectedSession ? (draftRef.current.get(selectedSession) ?? "") : "";
    });
    if (selectedSession) {
      sessionStorage.setItem("selectedSession", selectedSession);
      setUnreadSessions((prev) => {
        if (!prev.has(selectedSession)) return prev;
        const next = new Map(prev);
        next.delete(selectedSession);
        return next;
      });
    } else {
      sessionStorage.removeItem("selectedSession");
    }
  }, [selectedSession]);

  // Load sessions when instance changes
  useEffect(() => {
    if (!selectedInstance) {
      setSessions([]);
      setSelectedSession(null);
      setPendingPermissions((prev) => {
        if (prev.size === 0) return prev;
        return new Map();
      });
      return;
    }

    if (sessionRetryRef.current) {
      clearTimeout(sessionRetryRef.current);
      sessionRetryRef.current = null;
    }

    setSessionsLoading(true);

    let cancelled = false;
    let retries = 0;
    const maxRetries = 15;

    const fetchSessions = () => {
      fetch(apiUrl(selectedInstance, "/session"))
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          const list: Session[] = Array.isArray(data)
            ? data
            : Object.values(data || {});
          setSessions(list);
          setSelectedSession((prev) =>
            prev && list.some((s) => s.id === prev) ? prev : null
          );
          setSessionsLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          if (retries < maxRetries) {
            retries++;
            sessionRetryRef.current = setTimeout(fetchSessions, 2000);
          } else {
            console.error("Failed to load sessions after retries:", e);
            setSessionsLoading(false);
          }
        });
    };

    fetchSessions();

    // Fetch pending permissions for this instance
    const instanceId = selectedInstance;
    fetch(apiUrl(instanceId, "/permission"))
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Array<{ id: string; sessionID: string }>) => {
        setPendingPermissions((prev) => {
          const next = new Map(prev);
          // Replace all entries for this instance with fresh data
          for (const [k, v] of next) {
            if (v.instanceId === instanceId) next.delete(k);
          }
          for (const p of all) {
            next.set(p.id, { sessionId: p.sessionID, instanceId });
          }
          return next;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (sessionRetryRef.current) {
        clearTimeout(sessionRetryRef.current);
        sessionRetryRef.current = null;
      }
    };
  }, [selectedInstance]);

  // Listen for session updates via SSE for all instances
  const handleSessionEvent = useCallback(
    (evt: SSEEvent, instanceId: string) => {
      if (evt.type === "session.updated" || evt.type === "session.created") {
        const info = evt.properties.info as Session;
        if (info && info.id) {
          // Only update sessions state if event is from the currently selected instance
          if (instanceId === selectedInstanceRef.current) {
            setSessions((prev) => {
              const idx = prev.findIndex((s) => s.id === info.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...info };
                return updated;
              }
              return [...prev, info];
            });
          }
          // Mark unread if this isn't the currently open session
          if (info.id !== selectedSessionRef.current) {
            setUnreadSessions((prev) => {
              const next = new Map(prev);
              next.set(info.id, instanceId);
              return next;
            });
          }
        }
      }
      if (evt.type === "session.deleted") {
        const info = evt.properties.info as Session;
        if (info && info.id) {
          if (instanceId === selectedInstanceRef.current) {
            setSessions((prev) => prev.filter((s) => s.id !== info.id));
          }
          setUnreadSessions((prev) => {
            if (!prev.has(info.id)) return prev;
            const next = new Map(prev);
            next.delete(info.id);
            return next;
          });
        }
      }

      if (evt.type === "permission.asked") {
        const perm = evt.properties as unknown as { id: string; sessionID: string };
        if (perm.id && perm.sessionID) {
          setPendingPermissions((prev) => {
            if (prev.has(perm.id)) return prev;
            const next = new Map(prev);
            next.set(perm.id, { sessionId: perm.sessionID, instanceId });
            return next;
          });
        }
      }

      if (evt.type === "permission.replied") {
        const { requestID } = evt.properties as { requestID: string };
        if (requestID) {
          setPendingPermissions((prev) => {
            if (!prev.has(requestID)) return prev;
            const next = new Map(prev);
            next.delete(requestID);
            return next;
          });
        }
      }

      if (evt.type === "session.status") {
        const { sessionID, status } = evt.properties as { sessionID: string; status: SessionStatus };
        if (sessionID === selectedSessionRef.current && instanceId === selectedInstanceRef.current) {
          setBusy(status.type === "busy");
        }
      }
    },
    [],
  );

  const allInstanceIds = instances.map((i) => i.id);
  useSSE(allInstanceIds, handleSessionEvent);

  // Load messages when session changes
  useEffect(() => {
    if (!selectedInstance || !selectedSession) {
      setMessages([]);
      return;
    }

    if (messageRetryRef.current) {
      clearTimeout(messageRetryRef.current);
      messageRetryRef.current = null;
    }

    let cancelled = false;
    let retries = 0;
    const maxRetries = 15;

    const fetchMessages = () => {
      fetch(apiUrl(selectedInstance, `/session/${selectedSession}/message`))
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: MessageWithParts[]) => {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : Object.values(data || {});
          setMessages(list);
        })
        .catch((e) => {
          if (cancelled) return;
          if (retries < maxRetries) {
            retries++;
            messageRetryRef.current = setTimeout(fetchMessages, 2000);
          } else {
            console.error("Failed to load messages after retries:", e);
          }
        });
    };

    fetchMessages();

    return () => {
      cancelled = true;
      if (messageRetryRef.current) {
        clearTimeout(messageRetryRef.current);
        messageRetryRef.current = null;
      }
    };
  }, [selectedInstance, selectedSession]);

  // Ensure a session exists, returning its ID
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (!selectedInstance) return null;
    if (selectedSession) return selectedSession;
    const res = await fetch(apiUrl(selectedInstance, "/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const session: Session = await res.json();
    setSelectedSession(session.id);
    return session.id;
  }, [selectedInstance, selectedSession]);

  // Fire-and-forget send — SSE delivers updates
  const handleSendMessage = useCallback(
    async (text: string) => {
      const sessionId = await ensureSession();
      if (!sessionId || !selectedInstance) return;
      await fetch(
        apiUrl(selectedInstance, `/session/${sessionId}/prompt_async`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text }],
            ...(selectedModel ? { model: selectedModel } : {}),
          }),
        },
      );
    },
    [selectedInstance, ensureSession, selectedModel],
  );

  // Shell command — synchronous, SSE delivers streaming updates
  const handleSendShell = useCallback(
    async (command: string) => {
      const sessionId = await ensureSession();
      if (!sessionId || !selectedInstance) return;
      await fetch(
        apiUrl(selectedInstance, `/session/${sessionId}/shell`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent: "build", command }),
        },
      );
    },
    [selectedInstance, ensureSession],
  );

  // --- Dictation ---

  // Close the current WS (without stopping the mic or recording state)
  const closeWhisperWs = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(new Blob()); // end-of-stream signal
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Open a fresh WS connection to WhisperLiveKit, streaming from the existing mic
  const connectWhisper = useCallback(() => {
    if (!whisperUrl || !mediaStreamRef.current) return;

    // Tear down any existing recorder (keeps the mic stream alive)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    closeWhisperWs();

    const stream = mediaStreamRef.current;
    const ws = new WebSocket(whisperUrl);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const lines = Array.isArray(data.lines)
          ? data.lines.map((l: { text: string }) => l.text).join("").trim()
          : "";
        const buffer = (data.buffer_transcription || "").trim();
        const transcript = [lines, buffer].filter(Boolean).join(" ").trim();
        // Only update when the transcript actually changes
        if (transcript === dictationTextRef.current) return;
        dictationTextRef.current = transcript;
        // Splice ephemeral transcript into baseInput at the insertion point
        const base = baseInputRef.current;
        const pos = insertPosRef.current;
        const before = base.slice(0, pos);
        const after = base.slice(pos);
        const sep = transcript && before.length > 0 && !before.endsWith(" ") ? " " : "";
        const sepAfter = transcript && after.length > 0 && !after.startsWith(" ") ? " " : "";
        setInput(before + sep + transcript + sepAfter + after);
        // Restore cursor to end of the spliced dictation region
        const cursorTarget = before.length + sep.length + transcript.length;
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el && document.activeElement === el) {
            el.setSelectionRange(cursorTarget, cursorTarget);
          }
        });
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onopen = () => {
      setWhisperAvailable(true);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };
      recorder.start(250);
    };

    ws.onclose = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };

    ws.onerror = () => {
      setWhisperAvailable(false);
      stopDictation();
    };
  }, [whisperUrl]);

  const stopDictation = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    closeWhisperWs();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    dictationTextRef.current = "";
    setRecording(false);
  }, [closeWhisperWs]);

  // Commit ephemeral dictation text and reconnect WS to reset the transcript
  const commitDictation = useCallback(() => {
    if (!recording || !dictationTextRef.current) return;
    // The current input already has the spliced-in transcript — adopt it as the new base
    const el = textareaRef.current;
    const currentValue = el?.value ?? "";
    const cursorPos = el?.selectionStart ?? currentValue.length;
    baseInputRef.current = currentValue;
    insertPosRef.current = cursorPos;
    dictationTextRef.current = "";
    connectWhisper();
  }, [recording, connectWhisper]);

  const handleDictation = useCallback(async () => {
    if (recording) {
      stopDictation();
      return;
    }

    if (!whisperUrl) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    mediaStreamRef.current = stream;

    // Snapshot current input and cursor position
    const el = textareaRef.current;
    baseInputRef.current = input;
    insertPosRef.current = el?.selectionStart ?? input.length;
    dictationTextRef.current = "";

    setRecording(true);
    connectWhisper();
  }, [recording, whisperUrl, input, stopDictation, connectWhisper]);

  // Cleanup dictation on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // --- End dictation ---

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedInstance) return;
    setInput("");
    baseInputRef.current = "";
    insertPosRef.current = 0;
    dictationTextRef.current = "";
    if (recording) connectWhisper(); // reconnect to reset transcript
    if (selectedSession) draftRef.current.delete(selectedSession);
    setSessionView("chat");
    if (text.startsWith("!")) {
      await handleSendShell(text.slice(1).trim());
    } else {
      await handleSendMessage(text);
    }
  }, [input, selectedInstance, selectedSession, handleSendMessage, handleSendShell, recording, connectWhisper]);

  const handleStop = useCallback(async () => {
    if (!selectedInstance || !selectedSession) return;
    await fetch(apiUrl(selectedInstance, `/session/${selectedSession}/abort`), { method: "POST" });
  }, [selectedInstance, selectedSession]);

  const handleModelSelect = useCallback(async (model: ModelKey | null) => {
    const sessionId = model ? await ensureSession() : selectedSession;
    if (!sessionId) return;
    setSessionModels((prev) => {
      const next = new Map(prev);
      if (model) next.set(sessionId, model);
      else next.delete(sessionId);
      return next;
    });
  }, [selectedSession, ensureSession]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleTextareaBlur = useCallback(() => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart ?? 0;
    }
  }, []);

  const handleInsertMention = useCallback((filePath: string, startLine: number, endLine: number) => {
    const rootPath = instances.find((i) => i.id === selectedInstance)?.directory || "";
    const rel = filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length).replace(/^\//, "")
      : filePath;
    const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
    const mention = `@${rel}:${lineRange}`;
    const pos = cursorPosRef.current;
    setInput((prev) => {
      const before = prev.slice(0, pos);
      const after = prev.slice(pos);
      const prefix = before.length > 0 && !before.endsWith(" ") ? " " : "";
      const suffix = after.length > 0 && !after.startsWith(" ") ? " " : "";
      const inserted = prefix + mention + suffix;
      cursorPosRef.current = pos + prefix.length + mention.length;
      return before + inserted + after;
    });
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPosRef.current, cursorPosRef.current);
      }
    }, 0);
  }, [instances, selectedInstance]);

  const handleNewInstance = useCallback(() => {
    setView("new-instance");
  }, []);

  const handleInstanceSelect = useCallback(async (path: string, name: string) => {
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: path, name }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to create instance:", err);
        return;
      }
      await loadInstances();
      setView("main");
    } catch (e) {
      console.error("Failed to create instance:", e);
    }
  }, [loadInstances]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!selectedInstance) return;
    try {
      await fetch(apiUrl(selectedInstance, `/session/${id}`), { method: "DELETE" });
      if (selectedSession === id) {
        setSelectedSession(null);
        setMessages([]);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }, [selectedInstance, selectedSession]);

  const handleRemoveInstance = useCallback(async (id: string) => {
    try {
      await fetch(`/api/instances/${id}`, { method: "DELETE" });
      if (selectedInstance === id) {
        setSelectedInstance(null);
      }
      await loadInstances();
    } catch (e) {
      console.error("Failed to remove instance:", e);
    }
  }, [selectedInstance, loadInstances]);

  const selectedName =
    instances.find((i) => i.id === selectedInstance)?.name || "";

  const hasActivity = unreadSessions.size > 0 || pendingPermissions.size > 0;
  const unreadSessionIds = new Set(unreadSessions.keys());
  const unreadInstanceIds = new Set(unreadSessions.values());
  const pendingSessionIds = new Set([...pendingPermissions.values()].map((v) => v.sessionId));
  const pendingInstanceIds = new Set([...pendingPermissions.values()].map((v) => v.instanceId));

  const sortedSessions = [...sessions].sort((a, b) => {
    const aTime = a.time?.updated ?? a.time?.created ?? 0;
    const bTime = b.time?.updated ?? b.time?.created ?? 0;
    return bTime - aTime;
  });

  return (
    <div class="layout">
      {sidebarOpen && (
        <aside class="sidebar">
          <InstanceList
            instances={instances}
            selected={selectedInstance}
            onSelect={(id) => { setSelectedInstance(id); setView("main"); }}
            onNew={handleNewInstance}
            onRemove={handleRemoveInstance}
            unreadIds={unreadInstanceIds}
            pendingIds={pendingInstanceIds}
          />
          {selectedInstance && (
            <SessionList
              sessions={sortedSessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
              onDelete={handleDeleteSession}
              loading={sessionsLoading}
              unreadIds={unreadSessionIds}
              pendingIds={pendingSessionIds}
            />
          )}
          <div class="sidebar-footer">
            <a href="/logout" class="btn sidebar-logout">Logout</a>
          </div>
        </aside>
      )}
      <main class="main">
        <header class="topbar">
          <button
            class="btn sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            ☰
            {hasActivity && <span class="activity-bubble" aria-hidden="true">*</span>}
          </button>
          <div class="topbar-left">
            <h1 class="topbar-title">
              {selectedInstance && selectedSession
                ? `${selectedName} / ${selectedSession.slice(0, 12)}`
                : "Chaos Coordinator"}
            </h1>
          </div>
          {selectedInstance && (
            <div class="topbar-center">
              <button
                class="view-toggle-btn"
                aria-selected={sessionView === "chat"}
                aria-label="Chat"
                onClick={() => setSessionView("chat")}
              >
                {/* mdi:message */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z" />
                </svg>
              </button>
              <button
                class="view-toggle-btn"
                aria-selected={sessionView === "git"}
                aria-label="Git"
                onClick={() => setSessionView("git")}
              >
                {/* mdi:source-branch */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13,14C9.64,14 8.54,15.35 8.18,16.24C9.25,16.7 10,17.76 10,19A3,3 0 0,1 7,22A3,3 0 0,1 4,19C4,17.69 4.83,16.58 6,16.17V7.83C4.83,7.42 4,6.31 4,5A3,3 0 0,1 7,2A3,3 0 0,1 10,5C10,6.31 9.17,7.42 8,7.83V13.12C8.88,12.47 10.16,12 12,12C14.67,12 15.56,10.87 15.85,10C14.71,9.55 13.91,8.38 13.91,7A3.09,3.09 0 0,1 17,3.91A3.09,3.09 0 0,1 20.09,7C20.09,8.37 19.29,9.54 18.15,10C17.88,11.17 17.08,14 13,14Z" />
                </svg>
              </button>
              <button
                class="view-toggle-btn"
                aria-selected={sessionView === "explorer"}
                aria-label="Files"
                onClick={() => setSessionView("explorer")}
              >
                {/* mdi:folder */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
                </svg>
              </button>
              <button
                class="view-toggle-btn"
                aria-selected={sessionView === "settings"}
                aria-label="Settings"
                onClick={() => setSessionView("settings")}
              >
                {/* mdi:cog */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.97 19.05,5.05L16.56,6.05C16.04,5.65 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.65 7.44,6.05L4.95,5.05C4.73,4.97 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.95C7.96,18.35 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.35 16.56,17.95L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
                </svg>
              </button>
            </div>
          )}
        </header>
        {view === "new-instance" ? (
          <DirectoryPicker
            onSelect={handleInstanceSelect}
          />
        ) : !selectedInstance ? (
          <div class="empty-state">Select an instance to get started.</div>
        ) : sessionView === "git" ? (
          <GitStatus instanceId={selectedInstance} onInsertMention={handleInsertMention} />
        ) : sessionView === "explorer" ? (
          <Explorer instanceId={selectedInstance} rootPath={instances.find((i) => i.id === selectedInstance)?.directory || "/"} onInsertMention={handleInsertMention} />
        ) : sessionView === "settings" ? (
          <SessionSettings
            instanceId={selectedInstance}
            selectedModel={selectedModel}
            onModelSelect={handleModelSelect}
          />
        ) : (
          <Chat
            instanceId={selectedInstance}
            sessionId={selectedSession ?? ""}
            initialMessages={selectedSession ? messages : []}
          />
        )}
        {selectedInstance && view !== "new-instance" && (
          <form class="input-area" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <textarea
              ref={textareaRef}
              value={input}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                setInput(el.value);
                if (recording) {
                  baseInputRef.current = el.value;
                  insertPosRef.current = el.selectionStart ?? el.value.length;
                }
              }}
              onKeyDown={(e) => { commitDictation(); handleKeyDown(e); }}
              onPointerDown={commitDictation}
              onBlur={handleTextareaBlur}
              placeholder="Type a message..."
              rows={2}
            />
            {whisperUrl && (
              <button
                type="button"
                class={`btn btn-icon${recording ? " btn-icon--recording" : ""}`}
                disabled={!whisperAvailable && !recording}
                onClick={handleDictation}
                aria-label={!whisperAvailable ? "Transcription unavailable" : recording ? "Stop recording" : "Start dictation"}
              >
                {!whisperAvailable ? (
                  /* mdi:microphone-off — disabled/unreachable */
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19,11C19,12.19 18.66,13.3 18.1,14.28L16.87,13.05C17.14,12.43 17.3,11.74 17.3,11H19M15,11.16L9,5.18V5A3,3 0 0,1 12,2A3,3 0 0,1 15,5V11L15,11.16M4.27,3L21,19.73L19.73,21L15.54,16.81C14.77,17.27 13.91,17.58 13,17.72V21H11V17.72C7.72,17.23 5,14.41 5,11H6.7C6.7,14 9.24,16.1 12,16.1C12.81,16.1 13.6,15.91 14.31,15.58L12.65,13.92L12,14A3,3 0 0,1 9,11V10.28L3,4.27L4.27,3Z" />
                  </svg>
                ) : recording ? (
                  /* mdi:microphone-outline — recording active */
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17,11C17,13.76 14.76,16 12,16C9.24,16 7,13.76 7,11H5C5,14.53 7.61,17.44 11,17.93V21H13V17.93C16.39,17.44 19,14.53 19,11M12,4A1,1 0 0,0 11,5V11A1,1 0 0,0 12,12A1,1 0 0,0 13,11V5A1,1 0 0,0 12,4M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2Z" />
                  </svg>
                ) : (
                  /* mdi:microphone — idle/ready */
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              class="btn btn-icon"
              disabled={!busy}
              onClick={handleStop}
              aria-label="Stop"
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M9,9H15V15H9" />
              </svg>
            </button>
            <button type="submit" class="btn btn-icon" aria-label="Send">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15,20H9V12H4.16L12,4.16L19.84,12H15V20Z" />
              </svg>
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
