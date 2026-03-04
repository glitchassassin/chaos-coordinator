import { useDoubleCheck } from "../hooks/use-double-check.js";

interface Instance {
  id: string;
  name: string;
  port: number;
  directory: string;
}

interface Props {
  instances: Instance[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
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

export function InstanceList({ instances, selected, onSelect, onNew, onRemove }: Props) {
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
            {inst.name}
          </button>
          <RemoveButton onRemove={() => onRemove(inst.id)} label={`Remove ${inst.name}`} />
        </div>
      ))}
    </nav>
  );
}
