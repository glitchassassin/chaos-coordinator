import { useState, useEffect } from "preact/hooks";
import type { ProviderList, ModelKey, ProviderModel } from "../types.js";

interface Props {
  instanceId: string;
  selectedModel: ModelKey | null;
  onModelSelect: (model: ModelKey | null) => void;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function ReasoningIcon() {
  return (
    // mdi:brain
    <svg class="model-meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-label="Reasoning" role="img">
      <path d="M21.33,12.91C21.42,14.46 20.71,15.95 19.44,16.86L20.21,18.35C20.44,18.8 20.47,19.33 20.27,19.8C20.08,20.27 19.69,20.64 19.21,20.8L18.42,21.05C18.25,21.11 18.06,21.14 17.88,21.14C17.37,21.14 16.89,20.91 16.56,20.5L14.44,18C13.55,17.85 12.71,17.47 12,16.9C11.5,17.05 11,17.13 10.5,17.13C9.62,17.13 8.74,16.86 8,16.34C7.47,16.5 6.93,16.57 6.38,16.56C5.59,16.57 4.81,16.41 4.08,16.11C2.65,15.47 1.7,14.07 1.65,12.5C1.57,11.78 1.69,11.05 2,10.39C1.71,9.64 1.68,8.82 1.93,8.06C2.3,7.11 3,6.32 3.87,5.82C4.45,4.13 6.08,3 7.87,3.12C9.47,1.62 11.92,1.46 13.7,2.75C14.12,2.64 14.56,2.58 15,2.58C16.36,2.55 17.65,3.15 18.5,4.22C20.54,4.75 22,6.57 22.08,8.69C22.13,9.8 21.83,10.89 21.22,11.82C21.29,12.18 21.33,12.54 21.33,12.91M16.33,11.5C16.9,11.57 17.35,12 17.35,12.57A1,1 0 0,1 16.35,13.57H15.72C15.4,14.47 14.84,15.26 14.1,15.86C14.35,15.95 14.61,16 14.87,16.07C20,16 19.4,12.87 19.4,12.82C19.34,11.39 18.14,10.27 16.71,10.33A1,1 0 0,1 15.71,9.33A1,1 0 0,1 16.71,8.33C17.94,8.36 19.12,8.82 20.04,9.63C20.09,9.34 20.12,9.04 20.12,8.74C20.06,7.5 19.5,6.42 17.25,6.21C16,3.25 12.85,4.89 12.85,5.81V5.81C12.82,6.04 13.06,6.53 13.1,6.56A1,1 0 0,1 14.1,7.56C14.1,8.11 13.65,8.56 13.1,8.56V8.56C12.57,8.54 12.07,8.34 11.67,8C11.19,8.31 10.64,8.5 10.07,8.56V8.56C9.5,8.61 9.03,8.21 9,7.66C8.92,7.1 9.33,6.61 9.88,6.56C10.04,6.54 10.82,6.42 10.82,5.79V5.79C10.82,5.13 11.07,4.5 11.5,4C10.58,3.75 9.59,4.08 8.59,5.29C6.75,5 6,5.25 5.45,7.2C4.5,7.67 4,8 3.78,9C4.86,8.78 5.97,8.87 7,9.25C7.5,9.44 7.78,10 7.59,10.54C7.4,11.06 6.82,11.32 6.3,11.13C5.57,10.81 4.75,10.79 4,11.07C3.68,11.34 3.68,11.9 3.68,12.34C3.68,13.08 4.05,13.77 4.68,14.17C5.21,14.44 5.8,14.58 6.39,14.57C6.24,14.31 6.11,14.04 6,13.76C5.81,13.22 6.1,12.63 6.64,12.44C7.18,12.25 7.77,12.54 7.96,13.08C8.36,14.22 9.38,15 10.58,15.13C11.95,15.06 13.17,14.25 13.77,13C14,11.62 15.11,11.5 16.33,11.5M18.33,18.97L17.71,17.67L17,17.83L18,19.08L18.33,18.97M13.68,10.36C13.7,9.83 13.3,9.38 12.77,9.33C12.06,9.29 11.37,9.53 10.84,10C10.27,10.58 9.97,11.38 10,12.19A1,1 0 0,0 11,13.19C11.57,13.19 12,12.74 12,12.19C12,11.92 12.07,11.65 12.23,11.43C12.35,11.33 12.5,11.28 12.66,11.28C13.21,11.31 13.68,10.9 13.68,10.36Z" />
    </svg>
  );
}

function StatusIcon({ status }: { status: ProviderModel["status"] }) {
  if (status === "alpha") {
    return (
      // mdi:alpha
      <svg class="model-meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-label="Alpha" role="img">
        <path d="M18.08,17.8C17.62,17.93 17.21,18 16.85,18C15.65,18 14.84,17.12 14.43,15.35H14.38C13.39,17.26 12,18.21 10.25,18.21C8.94,18.21 7.89,17.72 7.1,16.73C6.31,15.74 5.92,14.5 5.92,13C5.92,11.25 6.37,9.85 7.26,8.76C8.15,7.67 9.36,7.12 10.89,7.12C11.71,7.12 12.45,7.35 13.09,7.8C13.73,8.26 14.22,8.9 14.56,9.73H14.6L15.31,7.33H17.87L15.73,12.65C15.97,13.89 16.22,14.74 16.5,15.19C16.74,15.64 17.08,15.87 17.5,15.87C17.74,15.87 17.93,15.83 18.1,15.76L18.08,17.8M13.82,12.56C13.61,11.43 13.27,10.55 12.81,9.95C12.36,9.34 11.81,9.04 11.18,9.04C10.36,9.04 9.7,9.41 9.21,10.14C8.72,10.88 8.5,11.79 8.5,12.86C8.5,13.84 8.69,14.65 9.12,15.31C9.54,15.97 10.11,16.29 10.82,16.29C11.42,16.29 11.97,16 12.46,15.45C12.96,14.88 13.37,14.05 13.7,12.96L13.82,12.56Z" />
      </svg>
    );
  }
  if (status === "beta") {
    return (
      // mdi:beta
      <svg class="model-meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-label="Beta" role="img">
        <path d="M9.23,17.59V23.12H6.88V6.72C6.88,5.27 7.31,4.13 8.16,3.28C9,2.43 10.17,2 11.61,2C13,2 14.07,2.34 14.87,3C15.66,3.68 16.05,4.62 16.05,5.81C16.05,6.63 15.79,7.4 15.27,8.11C14.75,8.82 14.08,9.31 13.25,9.58V9.62C14.5,9.82 15.47,10.27 16.13,11C16.79,11.71 17.12,12.62 17.12,13.74C17.12,15.06 16.66,16.14 15.75,16.97C14.83,17.8 13.63,18.21 12.13,18.21C11.07,18.21 10.1,18 9.23,17.59M10.72,10.75V8.83C11.59,8.72 12.3,8.4 12.87,7.86C13.43,7.31 13.71,6.7 13.71,6C13.71,4.62 13,3.92 11.6,3.92C10.84,3.92 10.25,4.16 9.84,4.65C9.43,5.14 9.23,5.82 9.23,6.71V15.5C10.14,16.03 11.03,16.29 11.89,16.29C12.73,16.29 13.39,16.07 13.86,15.64C14.33,15.2 14.56,14.58 14.56,13.79C14.56,12 13.28,11 10.72,10.75Z" />
      </svg>
    );
  }
  if (status === "deprecated") {
    return (
      // mdi:minus-circle
      <svg class="model-meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-label="Deprecated" role="img">
        <path d="M17,13H7V11H17M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
      </svg>
    );
  }
  return <span class="model-meta-icon-placeholder" aria-hidden="true" />;
}

function ModelRow({ model, providerID, isSelected, onSelect }: {
  model: ProviderModel;
  providerID: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const inputCost = model.cost ? formatCost(model.cost.input) : null;
  const outputCost = model.cost ? formatCost(model.cost.output) : null;

  return (
    <button
      class="model-row"
      aria-selected={isSelected}
      onClick={onSelect}
    >
      <span class="model-row-icons">
        {model.reasoning ? <ReasoningIcon /> : <span class="model-meta-icon-placeholder" aria-hidden="true" />}
        <StatusIcon status={model.status} />
      </span>
      <span class="model-row-name">{model.name}</span>
      {inputCost && outputCost && (
        <span class="model-row-cost" aria-label={`${inputCost} input, ${outputCost} output per million tokens`}>
          {inputCost} / {outputCost}
        </span>
      )}
    </button>
  );
}

export function SessionSettings({ instanceId, selectedModel, onModelSelect }: Props) {
  const [providerList, setProviderList] = useState<ProviderList | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/instances/${instanceId}/provider`)
      .then((r) => r.json())
      .then(setProviderList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instanceId]);

  if (loading) return <div class="settings-view"><div class="settings-loading">Loading models…</div></div>;
  if (!providerList) return <div class="settings-view"><div class="settings-error">Failed to load providers.</div></div>;

  const connectedSet = new Set(providerList.connected);
  const needle = query.trim().toLowerCase();
  const connected = providerList.all
    .filter((p) => connectedSet.has(p.id))
    .map((p) => ({
      ...p,
      models: Object.fromEntries(
        Object.entries(p.models).filter(
          ([, m]) =>
            !needle ||
            m.name.toLowerCase().includes(needle) ||
            p.name.toLowerCase().includes(needle),
        ),
      ),
    }))
    .filter((p) => Object.keys(p.models).length > 0);

  return (
    <div class="settings-view">
      <section class="settings-section">
        <h2 class="settings-section-title">Model</h2>
        <input
          class="model-search"
          type="search"
          placeholder="Search models…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          aria-label="Search models"
          autofocus
        />
        {!needle && (
          <button
            class="model-row"
            aria-selected={selectedModel === null}
            onClick={() => onModelSelect(null)}
          >
            <span class="model-row-icons">
              <span class="model-meta-icon-placeholder" aria-hidden="true" />
              <span class="model-meta-icon-placeholder" aria-hidden="true" />
            </span>
            <span class="model-row-name">Default (server configured)</span>
          </button>
        )}
        {connected.map((provider) => (
          <div class="model-provider-group" key={provider.id}>
            <div class="model-provider-name">{provider.name}</div>
            {Object.values(provider.models).map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                providerID={provider.id}
                isSelected={selectedModel?.providerID === provider.id && selectedModel?.modelID === model.id}
                onSelect={() => onModelSelect({ providerID: provider.id, modelID: model.id })}
              />
            ))}
          </div>
        ))}
        {connected.length === 0 && (
          <p class="settings-empty">{needle ? "No models match your search." : "No providers connected."}</p>
        )}
      </section>
    </div>
  );
}
