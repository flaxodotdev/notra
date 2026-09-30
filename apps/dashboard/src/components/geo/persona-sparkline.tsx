"use client";

import { cn } from "@/lib/utils";
import type { ChartColorPair } from "@/types/charts";

export interface PersonaSparklineProps {
  values: (number | null)[];
  colors: ChartColorPair;
  label: string;
  dimmed?: boolean;
}

const BAR_COUNT = 30;
const BAR_WIDTH = 3;

export function PersonaSparkline({
  values,
  colors,
  label,
  dimmed,
}: PersonaSparklineProps) {
  if (values.every((value) => value === null)) {
    return <span className="text-muted-foreground tabular-nums">—</span>;
  }
  const bars = values.slice(-BAR_COUNT);
  const max = Math.max(0, ...bars.filter((v): v is number => v !== null));
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex h-8 items-end gap-px", dimmed && "opacity-60")}
    >
      {bars.map((value, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="w-[3px] rounded-sm dark:hidden"
          style={{
            width: BAR_WIDTH,
            height:
              value === null || max === 0
                ? 2
                : `${Math.max(8, Math.round((value / 100) * 32))}px`,
            backgroundColor: colors.light,
            opacity: value === null ? 0.15 : 0.35 + 0.65 * (value / 100),
          }}
        />
      ))}
      {bars.map((value, index) => (
        <span
          key={`d-${index}`}
          aria-hidden="true"
          className="hidden w-[3px] rounded-sm dark:block"
          style={{
            width: BAR_WIDTH,
            height:
              value === null || max === 0
                ? 2
                : `${Math.max(8, Math.round((value / 100) * 32))}px`,
            backgroundColor: colors.dark,
            opacity: value === null ? 0.15 : 0.35 + 0.65 * (value / 100),
          }}
        />
      ))}
    </span>
  );
}
