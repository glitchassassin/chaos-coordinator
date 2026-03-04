import { useDoubleCheck } from "../hooks/use-double-check.js";

function GitHubIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" class="remote-icon">
      <path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/>
    </svg>
  );
}

function AzureDevOpsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" class="remote-icon">
      <path fill="currentColor" d="m22 18l-5 4l-8-3v3l-4.19-5.75l12.91 1.05V6.34L22 5.65zM4.81 16.25V8.96l12.91-2.62L10.6 2v2.84L3.97 6.76L2 9.38v5.69z"/>
    </svg>
  );
}

interface Instance {
  id: string;
  name: string;
  port: number;
  directory: string;
  remote?: "github" | "azuredevops";
}

interface Props {
  instances: Instance[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  unreadIds: Set<string>;
  pendingIds: Set<string>;
}

function RemoveButton({ onRemove, label }: { onRemove: () => void; label: string }) {
  const { pending, getButtonProps } = useDoubleCheck();
  return (
    <button
      class={`sidebar-item-remove${pending ? " sidebar-item-remove--confirm" : ""}`}
      aria-label={label}
      {...getButtonProps({ onClick: pending ? onRemove : undefined })}
    >
      {pending ? "Confirm?" : "×"}
    </button>
  );
}

export function InstanceList({ instances, selected, onSelect, onNew, onRemove, unreadIds, pendingIds }: Props) {
  return (
    <nav class="sidebar-section">
      <div class="sidebar-header-row">
        <h2 class="sidebar-header">Instances</h2>
        <button class="btn btn--small" onClick={onNew} title="New instance">+</button>
      </div>
      {instances.length === 0 && (
        <div class="loading">No instances configured</div>
      )}
      {instances.map((inst) => (
        <div key={inst.id} class="sidebar-item-row">
          <button
            class="sidebar-item"
            aria-selected={inst.id === selected}
            onClick={() => onSelect(inst.id)}
          >
            {inst.remote === "github" && <GitHubIcon />}{inst.remote === "azuredevops" && <AzureDevOpsIcon />}{inst.name}{pendingIds.has(inst.id) ? " (?)" : unreadIds.has(inst.id) ? " *" : ""}
          </button>
          <RemoveButton onRemove={() => onRemove(inst.id)} label={`Remove ${inst.name}`} />
        </div>
      ))}
    </nav>
  );
}
