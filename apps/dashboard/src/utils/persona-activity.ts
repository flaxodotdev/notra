import type { GeoSparklinePoint } from "@notra/geo-core/types/geo";
import type {
  GeoPersona,
  GeoPersonaActivityPoint,
  GeoPersonaActivityResponse,
} from "@notra/geo-core/types/geo-personas";
import { todayIsoDate } from "@notra/geo-core/utils/day-label";

import {
  GEO_PERSONA_CHART_MAX_STEP,
  GEO_PERSONA_CHART_MIN_MAX,
  GEO_PERSONA_FORECAST_DAYS,
  GEO_PERSONA_FORECAST_SAMPLE_DAYS,
} from "@/constants/geo-personas";
import type { PersonaActivitySeries } from "@/types/geo-personas";
import { chartKey } from "@/utils/chart-keys";

function activityPointKey(
  day: string,
  personaId: string,
  snapshotVersion: string
) {
  return `${day}:${personaId}:${snapshotVersion}`;
}

export function personaActivityKey(personaId: string, snapshotVersion: string) {
  return chartKey(`${personaId}:${snapshotVersion}`);
}

export function personaForecastKey(personaId: string, snapshotVersion: string) {
  return chartKey(`${personaId}:${snapshotVersion}:forecast`);
}

export function buildPersonaActivitySeries(
  activity: GeoPersonaActivityResponse,
  personas: readonly GeoPersona[]
): PersonaActivitySeries[] {
  const latestChecks = new Map<string, Map<string, string>>();
  for (const point of activity.points) {
    const versions = latestChecks.get(point.personaId) ?? new Map();
    const current = versions.get(point.snapshotVersion);
    if (!current || point.lastCheckedAt > current) {
      versions.set(point.snapshotVersion, point.lastCheckedAt);
    }
    latestChecks.set(point.personaId, versions);
  }

  return personas.flatMap((persona) => {
    const versions = [...(latestChecks.get(persona.id)?.entries() ?? [])].sort(
      ([leftVersion, leftCheckedAt], [rightVersion, rightCheckedAt]) =>
        rightCheckedAt.localeCompare(leftCheckedAt) ||
        leftVersion.localeCompare(rightVersion)
    );
    return versions.map(([snapshotVersion], index) => ({
      personaId: persona.id,
      snapshotVersion,
      dataKey: personaActivityKey(persona.id, snapshotVersion),
      label:
        index === 0
          ? persona.name
          : `${persona.name} (previous · ${snapshotVersion.slice(0, 7)})`,
      isCurrent: index === 0,
    }));
  });
}

function mentionRate(point: GeoPersonaActivityPoint | undefined) {
  return point && point.checks > 0
    ? (point.mentions / point.checks) * 100
    : null;
}

function lastScanDayByKey(points: readonly GeoPersonaActivityPoint[]) {
  const lastDay = new Map<string, string>();
  for (const point of points) {
    if (point.checks <= 0) {
      continue;
    }
    const key = personaActivityKey(point.personaId, point.snapshotVersion);
    const current = lastDay.get(key);
    if (!current || point.day > current) {
      lastDay.set(key, point.day);
    }
  }
  return lastDay;
}

/**
 * A day without checks reads as 0% so the line stays on the baseline instead
 * of breaking. Two exceptions stay empty: today before its scan has landed
 * (the forecast bridges it), and days after a previous snapshot was replaced.
 */
function missingDayRate(
  item: PersonaActivitySeries,
  day: string,
  today: string,
  lastScanDay: ReadonlyMap<string, string>
) {
  if (item.isCurrent) {
    return day < today ? 0 : null;
  }
  const last = lastScanDay.get(item.dataKey);
  return last !== undefined && day <= last ? 0 : null;
}

export function buildPersonaActivityRows(
  activity: GeoPersonaActivityResponse,
  series: readonly PersonaActivitySeries[],
  today = todayIsoDate()
) {
  const points = new Map(
    activity.points.map((point) => [
      activityPointKey(point.day, point.personaId, point.snapshotVersion),
      point,
    ])
  );
  const lastScanDay = lastScanDayByKey(activity.points);
  const rows: Record<string, string | number | null>[] = [];
  const date = new Date(`${activity.from}T00:00:00Z`);
  while (date.toISOString().slice(0, 10) < activity.to) {
    const day = date.toISOString().slice(0, 10);
    const row: Record<string, string | number | null> = { day };
    for (const item of series) {
      const rate = mentionRate(
        points.get(activityPointKey(day, item.personaId, item.snapshotVersion))
      );
      row[item.dataKey] = rate ?? missingDayRate(item, day, today, lastScanDay);
    }
    rows.push(row);
    date.setUTCDate(date.getUTCDate() + 1);
  }

  const last = rows.at(-1);
  if (last?.day !== today) {
    return rows;
  }

  const forecasts = new Map<string, number>();
  for (const item of series) {
    if (!item.isCurrent) {
      continue;
    }
    const samples = activity.points
      .filter(
        (point) =>
          point.personaId === item.personaId &&
          point.snapshotVersion === item.snapshotVersion &&
          point.checks > 0 &&
          point.day >= activity.from &&
          point.day <= today
      )
      .toSorted((left, right) => right.day.localeCompare(left.day))
      .slice(0, GEO_PERSONA_FORECAST_SAMPLE_DAYS);
    let checks = 0;
    let mentions = 0;
    for (const sample of samples) {
      checks += sample.checks;
      mentions += sample.mentions;
    }
    if (!checks) {
      continue;
    }
    const key = personaForecastKey(item.personaId, item.snapshotVersion);
    const forecast = Math.max(0, Math.min(100, (mentions / checks) * 100));
    forecasts.set(key, forecast);
    // Start the dashed line on the latest actual value so it continues the
    // solid one; while today's scan is pending, today already shows the forecast.
    const todayRate = last[item.dataKey];
    if (typeof todayRate === "number") {
      last[key] = todayRate;
      continue;
    }
    last[key] = forecast;
    const previous = rows.at(-2);
    if (previous) {
      previous[key] = previous[item.dataKey] ?? null;
    }
  }
  if (!forecasts.size) {
    return rows;
  }

  for (let offset = 0; offset < GEO_PERSONA_FORECAST_DAYS; offset++) {
    const row: Record<string, string | number | null> = {
      day: date.toISOString().slice(0, 10),
    };
    for (const item of series) {
      row[item.dataKey] = null;
      if (item.isCurrent) {
        const forecastKey = personaForecastKey(
          item.personaId,
          item.snapshotVersion
        );
        row[forecastKey] = forecasts.get(forecastKey) ?? null;
      }
    }
    rows.push(row);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return rows;
}

export function personaMentionRate(
  activity: GeoPersonaActivityResponse,
  personaId: string,
  snapshotVersion: string | undefined
) {
  if (!snapshotVersion) {
    return null;
  }
  let mentions = 0;
  let checks = 0;
  for (const point of activity.points) {
    if (
      point.personaId !== personaId ||
      point.snapshotVersion !== snapshotVersion
    ) {
      continue;
    }
    mentions += point.mentions;
    checks += point.checks;
  }
  return checks ? (mentions / checks) * 100 : null;
}

/**
 * Y-axis ceiling for the visible series: the highest rate rounded up to the
 * next step, so a 37% peak uses the chart height instead of a fixed 0–100%.
 */
export function personaActivityAxisMax(
  rows: readonly Record<string, string | number | null>[],
  keys: readonly string[]
) {
  let peak = 0;
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number" && value > peak) {
        peak = value;
      }
    }
  }
  const ceiling =
    Math.floor(peak / GEO_PERSONA_CHART_MAX_STEP + 1) *
    GEO_PERSONA_CHART_MAX_STEP;
  return Math.min(100, Math.max(GEO_PERSONA_CHART_MIN_MAX, ceiling));
}

/** Snapshot version with the most recent check — mirrors the card's "current" series. */
export function currentPersonaSnapshotVersion(
  activity: GeoPersonaActivityResponse,
  personaId: string
): string | undefined {
  let latest: { version: string; at: string } | null = null;
  for (const point of activity.points) {
    if (point.personaId !== personaId) {
      continue;
    }
    if (!latest || point.lastCheckedAt > latest.at) {
      latest = { version: point.snapshotVersion, at: point.lastCheckedAt };
    }
  }
  return latest?.version;
}

/**
 * Daily mention rates for one persona as sparkline points, oldest first,
 * capped at the latest `maxDays` calendar days of the response window.
 * Days without observations read as 0 so points stay aligned with the
 * range — the same slot-per-day shape the GeoRateSparkline consumers use.
 */
export function personaSparklinePoints(
  activity: GeoPersonaActivityResponse,
  personaId: string,
  snapshotVersion: string | undefined,
  maxDays = 30
): GeoSparklinePoint[] {
  if (!snapshotVersion) {
    return [];
  }
  const byDay = new Map<string, GeoPersonaActivityPoint>();
  for (const point of activity.points) {
    if (
      point.personaId !== personaId ||
      point.snapshotVersion !== snapshotVersion
    ) {
      continue;
    }
    const current = byDay.get(point.day);
    if (!current || point.lastCheckedAt > current.lastCheckedAt) {
      byDay.set(point.day, point);
    }
  }
  const days: string[] = [];
  const cursor = new Date(`${activity.from}T00:00:00Z`);
  const endDay = new Date(`${activity.to}T00:00:00Z`)
    .toISOString()
    .slice(0, 10);
  let day = cursor.toISOString().slice(0, 10);
  while (day < endDay) {
    days.push(day);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    day = cursor.toISOString().slice(0, 10);
  }
  return days.slice(Math.max(0, days.length - maxDays)).map((day) => {
    const point = byDay.get(day);
    const value = point ? mentionRate(point) : null;
    return { day, value: value ?? 0 };
  });
}
