import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { InstanceList } from "./components/instance-list.js";
import { SessionList } from "./components/session-list.js";
import { Chat } from "./components/chat.js";
import { GitStatus } from "./components/git-status.js";
import { Explorer } from "./components/explorer.js";
import { DirectoryPicker } from "./components/directory-picker.js";
import { useSSE } from "./hooks/use-sse.js";
import type { Instance, Session, MessageWithParts, SSEEvent } from "./types.js";

type View = "main" | "new-instance";
type SessionView = "chat" | "git" | "explorer";

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
  // sessionId -> instanceId for unread tracking (default: all read on open)
  const [unreadSessions, setUnreadSessions] = useState<Map<string, string>>(() => new Map());
  // requestId -> { sessionId, instanceId } for pending permission tracking
  const [pendingPermissions, setPendingPermissions] = useState<Map<string, { sessionId: string; instanceId: string }>>(() => new Map());

  const selectedSessionRef = useRef<string | null>(selectedSession);
  const selectedInstanceRef = useRef<string | null>(selectedInstance);
  const sessionRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Persist selections
  useEffect(() => {
    if (selectedInstance) sessionStorage.setItem("selectedInstance", selectedInstance);
    else sessionStorage.removeItem("selectedInstance");
  }, [selectedInstance]);

  useEffect(() => {
    setSessionView("chat");
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

  const handleCreateSession = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(apiUrl(selectedInstance, "/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const session: Session = await res.json();
      setSelectedSession(session.id);
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  }, [selectedInstance]);

  // Fire-and-forget send — SSE delivers updates
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedInstance || !selectedSession) return;
      await fetch(
        apiUrl(selectedInstance, `/session/${selectedSession}/prompt_async`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts: [{ type: "text", text }],
          }),
        },
      );
    },
    [selectedInstance, selectedSession],
  );

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
              onCreate={handleCreateSession}
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
          {selectedInstance && selectedSession && (
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
            </div>
          )}
        </header>
        {view === "new-instance" ? (
          <DirectoryPicker
            onSelect={handleInstanceSelect}
          />
        ) : selectedInstance && selectedSession ? (
          sessionView === "git" ? (
            <GitStatus instanceId={selectedInstance} />
          ) : sessionView === "explorer" ? (
            <Explorer instanceId={selectedInstance} rootPath={instances.find((i) => i.id === selectedInstance)?.directory || "/"} />
          ) : (
            <Chat
              instanceId={selectedInstance}
              sessionId={selectedSession}
              initialMessages={messages}
              onSend={handleSendMessage}
            />
          )
        ) : (
          <div class="empty-state">
            {!selectedInstance
              ? "Select an instance to get started."
              : "Select or create a session."}
          </div>
        )}
      </main>
    </div>
  );
}
