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
}

export function InstanceList({ instances, selected, onSelect }: Props) {
  return (
    <div class="sidebar-section">
      <div class="sidebar-header">Instances</div>
      {instances.length === 0 && (
        <div class="loading">No instances configured</div>
      )}
      {instances.map((inst) => (
        <button
          key={inst.id}
          class="sidebar-item"
          aria-selected={inst.id === selected}
          onClick={() => onSelect(inst.id)}
        >
          {inst.name}
          <span class="sidebar-item-sub">:{inst.port}</span>
        </button>
      ))}
    </div>
  );
}
