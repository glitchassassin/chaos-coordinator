import { useState, useEffect, useCallback } from "preact/hooks";
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
    if (selectedSession) sessionStorage.setItem("selectedSession", selectedSession);
    else sessionStorage.removeItem("selectedSession");
  }, [selectedSession]);

  // Load sessions when instance changes
  useEffect(() => {
    if (!selectedInstance) {
      setSessions([]);
      setSelectedSession(null);
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
  }, [selectedInstance]);

  // Listen for session updates via SSE
  const handleSessionEvent = useCallback(
    (evt: SSEEvent) => {
      if (evt.type === "session.updated" || evt.type === "session.created") {
        const info = evt.properties.info as Session;
        if (info && info.id) {
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
      }
      if (evt.type === "session.deleted") {
        const info = evt.properties.info as Session;
        if (info && info.id) {
          setSessions((prev) => prev.filter((s) => s.id !== info.id));
        }
      }
    },
    [],
  );

  useSSE(selectedInstance, handleSessionEvent);

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
          />
          {selectedInstance && (
            <SessionList
              sessions={sessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
              onCreate={handleCreateSession}
              onDelete={handleDeleteSession}
              loading={sessionsLoading}
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
