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
  pendingIds: Set<string>;
}

function DeleteButton({ onDelete, label }: { onDelete: () => void; label: string }) {
  const { pending, getButtonProps } = useDoubleCheck();
  return (
    <button
      class={`sidebar-item-remove${pending ? " sidebar-item-remove--confirm" : ""}`}
      aria-label={pending ? "Confirm delete" : label}
      {...getButtonProps({ onClick: pending ? onDelete : undefined })}
    >
      {pending ? (
        /* mdi:check-circle */
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="1.25em" height="1.25em" fill="currentColor">
          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z" />
        </svg>
      ) : (
        /* mdi:delete-forever */
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" width="1.25em" height="1.25em" fill="currentColor">
          <path d="M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19M8.46,11.88L9.87,10.46L12,12.59L14.12,10.46L15.54,11.88L13.41,14L15.54,16.12L14.12,17.54L12,15.41L9.87,17.54L8.46,16.12L10.59,14L8.46,11.88M15.5,4L14.5,3H9.5L8.5,4H5V6H19V4H15.5Z" />
        </svg>
      )}
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
  pendingIds,
}: Props) {
  return (
    <nav class="sidebar-section" style={{ flex: 1, overflow: "auto" }}>
      <div class="sidebar-section-header">
        <span class="sidebar-section-icon" aria-hidden="true">
          {/* mdi:message */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z" />
          </svg>
        </span>
        <h2 class="sidebar-header">Sessions</h2>
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
            {s.title || s.id.slice(0, 12)}{pendingIds.has(s.id) ? " (?)" : unreadIds.has(s.id) ? " *" : ""}
          </button>
          <DeleteButton onDelete={() => onDelete(s.id)} label={`Delete session ${s.title || s.id.slice(0, 12)}`} />
        </div>
      ))}
      <button class="sidebar-item sidebar-item--add" onClick={onCreate}>+ Add Session</button>
    </nav>
  );
}
