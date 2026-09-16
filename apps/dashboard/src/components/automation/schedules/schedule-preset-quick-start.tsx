"use client";

import { cn } from "@notra/ui/lib/utils";

import {
  SCHEDULE_PRESETS,
  type SchedulePresetId,
} from "@/constants/schedule-presets";

export function SchedulePresetQuickStart({
  onSelect,
}: {
  onSelect: (id: SchedulePresetId) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Quick start</h2>
        <p className="text-muted-foreground text-sm">
          Spin up a schedule preconfigured for a common cadence. Optional —
          tweak anything before saving.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SCHEDULE_PRESETS.map((preset) => (
          <button
            className={cn(
              "group bg-card relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
              "border-border hover:border-foreground/20"
            )}
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            type="button"
          >
            <span className="text-sm font-medium">{preset.label}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
