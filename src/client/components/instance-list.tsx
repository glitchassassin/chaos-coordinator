import { useState } from "preact/hooks";

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

export function InstanceList({ instances, selected, onSelect, onNew, onRemove }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);

  function handleRemoveClick(e: MouseEvent, id: string) {
    e.stopPropagation();
    setConfirming(id);
  }

  function handleConfirmYes(e: MouseEvent, id: string) {
    e.stopPropagation();
    setConfirming(null);
    onRemove(id);
  }

  function handleConfirmNo(e: MouseEvent) {
    e.stopPropagation();
    setConfirming(null);
  }

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
            <span class="sidebar-item-sub">:{inst.port}</span>
          </button>
          {confirming === inst.id ? (
            <span class="sidebar-item-confirm">
              <button class="btn btn--small btn--danger" onClick={(e) => handleConfirmYes(e, inst.id)}>Yes</button>
              <button class="btn btn--small" onClick={handleConfirmNo}>No</button>
            </span>
          ) : (
            <button
              class="sidebar-item-remove"
              onClick={(e) => handleRemoveClick(e, inst.id)}
              aria-label={`Remove ${inst.name}`}
              title="Remove instance"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
