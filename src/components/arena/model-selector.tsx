"use client";

import { availableModels } from "@/lib/ai-gateway";

interface ModelSelectorProps {
  selectedModels: string[];
  onSelectionChange: (models: string[]) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModels,
  onSelectionChange,
  disabled,
}: ModelSelectorProps) {
  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      onSelectionChange(selectedModels.filter((id) => id !== modelId));
    } else {
      onSelectionChange([...selectedModels, modelId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(availableModels.map((m) => m.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="neon-card rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-lg shadow-[0_30px_80px_-70px_var(--primary)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            roster
          </p>
          <h3 className="font-display text-lg text-white">Select Models</h3>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={selectAll}
            disabled={disabled}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            disabled={disabled}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {availableModels.map((model) => {
          const active = selectedModels.includes(model.id);
          return (
            <label
              key={model.id}
              className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-150 ${
                active
                  ? "border-primary/60 bg-primary/10 shadow-[0_15px_50px_-35px_var(--primary)]"
                  : "border-white/10 bg-white/5 hover:border-primary/40"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleModel(model.id)}
                disabled={disabled}
                className="h-4 w-4 rounded border-white/20 text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">
                  {model.name}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
                  {model.provider}
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {active ? "ON" : "OFF"}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
