interface Session {
  id: string;
  title?: string;
  createdAt?: string;
}

interface Props {
  sessions: Session[];
  selected: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  loading: boolean;
}

export function SessionList({
  sessions,
  selected,
  onSelect,
  onCreate,
  loading,
}: Props) {
  return (
    <div class="sidebar-section" style={{ flex: 1, overflow: "auto" }}>
      <div
        class="sidebar-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>Sessions</span>
        <button
          class="btn"
          style={{ minHeight: "28px", minWidth: "28px", fontSize: "0.75rem", padding: "0 0.5rem" }}
          onClick={onCreate}
        >
          + New
        </button>
      </div>
      {loading && <div class="loading">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div class="loading">No sessions</div>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          class="sidebar-item"
          aria-selected={s.id === selected}
          onClick={() => onSelect(s.id)}
        >
          {s.title || s.id.slice(0, 12)}
        </button>
      ))}
    </div>
  );
}
