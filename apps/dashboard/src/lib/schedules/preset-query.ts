import { toUtcDateString } from "@notra/ai/utils/schedule-interval";
import {
  CRON_FREQUENCIES,
  LOOKBACK_WINDOWS,
  SUPPORTED_AUTOMATION_OUTPUT_TYPES,
  type CronFrequency,
  type LookbackWindow,
  type ScheduleOutputType,
} from "@notra/schemas/dashboard/integrations";
import { parseAsInteger, parseAsStringLiteral } from "nuqs";

import {
  SCHEDULE_PRESETS,
  type SchedulePresetId,
} from "@/constants/schedule-presets";
import type { PresetScheduleValues } from "@/utils/schedule-form";

/**
 * Shareable schedule-preset state, modelled on the API key quick-start flow.
 * Selecting a preset writes its values to the URL, so a preset is just a
 * link — nothing extra to store. The create dialog reads these params back
 * as its initial values.
 */
export const SCHEDULE_PRESET_QUERY_PARSERS = {
  outputType: parseAsStringLiteral(SUPPORTED_AUTOMATION_OUTPUT_TYPES),
  frequency: parseAsStringLiteral(CRON_FREQUENCIES),
  hour: parseAsInteger,
  minute: parseAsInteger,
  dayOfWeek: parseAsInteger,
  dayOfMonth: parseAsInteger,
  intervalDays: parseAsInteger,
  lookback: parseAsStringLiteral(LOOKBACK_WINDOWS),
};

export interface SchedulePresetQueryConfig {
  outputType: ScheduleOutputType | null;
  frequency: CronFrequency | null;
  hour: number | null;
  minute: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  intervalDays: number | null;
  lookback: LookbackWindow | null;
}

function isValidHour(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 23
  );
}

function isValidMinute(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 59
  );
}

function isValidDayOfWeek(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

function isValidDayOfMonth(value: number | null): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 31
  );
}

function isValidIntervalDays(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** True when the URL carries enough state to prefill the create dialog. */
export function hasSchedulePresetQueryConfig(
  config: SchedulePresetQueryConfig
): boolean {
  return (
    config.outputType !== null ||
    config.frequency !== null ||
    config.hour !== null ||
    config.minute !== null ||
    config.dayOfWeek !== null ||
    config.dayOfMonth !== null ||
    config.intervalDays !== null ||
    config.lookback !== null
  );
}

/**
 * Convert URL query state back into dialog initial values. Returns null when
 * required fields are missing or out of range, so hand-crafted or stale URLs
 * fall back to the blank form instead of crashing.
 */
export function schedulePresetQueryToValues(
  config: SchedulePresetQueryConfig
): PresetScheduleValues | null {
  const { outputType, frequency, hour, minute, lookback } = config;
  if (
    outputType === null ||
    frequency === null ||
    !isValidHour(hour) ||
    !isValidMinute(minute) ||
    lookback === null
  ) {
    return null;
  }
  if (frequency === "weekly" && !isValidDayOfWeek(config.dayOfWeek)) {
    return null;
  }
  if (frequency === "monthly" && !isValidDayOfMonth(config.dayOfMonth)) {
    return null;
  }
  if (frequency === "custom" && !isValidIntervalDays(config.intervalDays)) {
    return null;
  }
  return {
    outputType,
    schedule: {
      frequency,
      hour,
      minute,
      ...(frequency === "weekly"
        ? { dayOfWeek: config.dayOfWeek as number }
        : {}),
      ...(frequency === "monthly"
        ? { dayOfMonth: config.dayOfMonth as number }
        : {}),
      ...(frequency === "custom"
        ? {
            intervalDays: config.intervalDays as number,
            anchorDate: toUtcDateString(new Date()),
          }
        : {}),
    },
    lookbackWindow: lookback,
  };
}

/** Serialize a preset into URL query state (the preset becomes a link). */
export function schedulePresetToQuery(
  presetId: SchedulePresetId
): SchedulePresetQueryConfig {
  const preset = SCHEDULE_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    throw new Error(`Unknown schedule preset: ${presetId}`);
  }
  const { outputType, schedule, lookbackWindow } = preset.values;
  return {
    outputType,
    frequency: schedule.frequency,
    hour: schedule.hour,
    minute: schedule.minute,
    dayOfWeek: schedule.dayOfWeek ?? null,
    dayOfMonth: schedule.dayOfMonth ?? null,
    intervalDays: schedule.intervalDays ?? null,
    lookback: lookbackWindow,
  };
}
