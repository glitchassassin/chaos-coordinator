import { useDoubleCheck } from "../hooks/use-double-check.js";

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
  onDelete: (id: string) => void;
  loading: boolean;
  unreadIds: Set<string>;
}

function DeleteButton({ onDelete, label }: { onDelete: () => void; label: string }) {
  const { pending, getButtonProps } = useDoubleCheck();
  return (
    <button
      class={`sidebar-item-remove${pending ? " sidebar-item-remove--confirm" : ""}`}
      aria-label={label}
      {...getButtonProps({ onClick: pending ? onDelete : undefined })}
    >
      {pending ? "Confirm?" : "×"}
    </button>
  );
}

export function SessionList({
  sessions,
  selected,
  onSelect,
  onCreate,
  onDelete,
  loading,
  unreadIds,
}: Props) {
  return (
    <nav class="sidebar-section" style={{ flex: 1, overflow: "auto" }}>
      <div class="sidebar-header-row">
        <h2 class="sidebar-header">Sessions</h2>
        <button class="btn btn--small" onClick={onCreate}>+ New</button>
      </div>
      {loading && <div class="loading">Loading...</div>}
      {!loading && sessions.length === 0 && (
        <div class="loading">No sessions</div>
      )}
      {sessions.map((s) => (
        <div key={s.id} class="sidebar-item-row">
          <button
            class="sidebar-item"
            aria-selected={s.id === selected}
            onClick={() => onSelect(s.id)}
          >
            {s.title || s.id.slice(0, 12)}{unreadIds.has(s.id) ? " *" : ""}
          </button>
          <DeleteButton onDelete={() => onDelete(s.id)} label={`Delete session ${s.title || s.id.slice(0, 12)}`} />
        </div>
      ))}
    </nav>
  );
}
