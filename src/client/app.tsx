import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { InstanceList } from "./components/instance-list.js";
import { SessionList } from "./components/session-list.js";
import { Chat } from "./components/chat.js";
import { DirectoryPicker } from "./components/directory-picker.js";
import { useSSE } from "./hooks/use-sse.js";
import type { Instance, Session, MessageWithParts, SSEEvent } from "./types.js";

type View = "main" | "new-instance";

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
  // sessionId -> instanceId for unread tracking (default: all read on open)
  const [unreadSessions, setUnreadSessions] = useState<Map<string, string>>(() => new Map());
  // requestId -> { sessionId, instanceId } for pending permission tracking
  const [pendingPermissions, setPendingPermissions] = useState<Map<string, { sessionId: string; instanceId: string }>>(() => new Map());

  const selectedSessionRef = useRef<string | null>(selectedSession);
  const selectedInstanceRef = useRef<string | null>(selectedInstance);
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

    setSessionsLoading(true);

    fetch(apiUrl(selectedInstance, "/session"))
      .then((r) => r.json())
      .then((data) => {
        const list: Session[] = Array.isArray(data)
          ? data
          : Object.values(data || {});
        setSessions(list);
        // If restored session no longer exists, clear it
        setSelectedSession((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : null
        );
      })
      .catch(console.error)
      .finally(() => setSessionsLoading(false));

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

    fetch(apiUrl(selectedInstance, `/session/${selectedSession}/message`))
      .then((r) => r.json())
      .then((data: MessageWithParts[]) => {
        const list = Array.isArray(data) ? data : Object.values(data || {});
        setMessages(list);
      })
      .catch(console.error);
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
        </aside>
      )}
      <main class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button
              class="btn sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              ☰
              {hasActivity && <span class="activity-bubble" aria-hidden="true">*</span>}
            </button>
            <h1 class="topbar-title">
              {selectedInstance && selectedSession
                ? `${selectedName} / ${selectedSession.slice(0, 12)}`
                : "Chaos Coordinator"}
            </h1>
          </div>
          <div class="topbar-actions">
            <a href="/logout" class="btn">
              Logout
            </a>
          </div>
        </header>
        {view === "new-instance" ? (
          <DirectoryPicker
            onSelect={handleInstanceSelect}
          />
        ) : selectedInstance && selectedSession ? (
          <Chat
            instanceId={selectedInstance}
            sessionId={selectedSession}
            initialMessages={messages}
            onSend={handleSendMessage}
          />
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
