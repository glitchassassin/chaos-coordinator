import { useState, useEffect, useCallback } from "preact/hooks";
import { InstanceList } from "./components/instance-list.js";
import { SessionList } from "./components/session-list.js";
import { Chat } from "./components/chat.js";
import type { Instance, Session, MessageWithParts } from "./types.js";

function apiUrl(instanceId: string, path: string): string {
  return `/api/instances/${instanceId}${path}`;
}

export function App() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithParts[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load instances
  useEffect(() => {
    fetch("/api/instances")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return [];
        }
        return r.json();
      })
      .then(setInstances)
      .catch(console.error);
  }, []);

  // Load sessions when instance changes
  useEffect(() => {
    if (!selectedInstance) {
      setSessions([]);
      setSelectedSession(null);
      return;
    }

    setSessionsLoading(true);
    setSelectedSession(null);
    setMessages([]);

    fetch(apiUrl(selectedInstance, "/session"))
      .then((r) => r.json())
      .then((data) => {
        const list: Session[] = Array.isArray(data)
          ? data
          : Object.values(data || {});
        setSessions(list);
      })
      .catch(console.error)
      .finally(() => setSessionsLoading(false));
  }, [selectedInstance]);

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
      setSessions((prev) => [...prev, session]);
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

  const selectedName =
    instances.find((i) => i.id === selectedInstance)?.name || "";

  return (
    <div class="layout">
      {sidebarOpen && (
        <aside class="sidebar">
          <InstanceList
            instances={instances}
            selected={selectedInstance}
            onSelect={setSelectedInstance}
          />
          {selectedInstance && (
            <SessionList
              sessions={sessions}
              selected={selectedSession}
              onSelect={setSelectedSession}
              onCreate={handleCreateSession}
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
        {selectedInstance && selectedSession ? (
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
