import { describe, expect, test } from "bun:test";

import { toUtcDateString } from "@notra/ai/utils/schedule-interval";
import { scheduleFormSchema } from "@notra/schemas/dashboard/automation/schedule-form";

import {
  SCHEDULE_PRESETS,
  type SchedulePresetId,
} from "../src/constants/schedule-presets";
import {
  hasSchedulePresetQueryConfig,
  schedulePresetQueryToValues,
  schedulePresetToQuery,
  type SchedulePresetQueryConfig,
} from "../src/lib/schedules/preset-query";
import { getPresetScheduleValues } from "../src/utils/schedule-form";

const PRESET_IDS: SchedulePresetId[] = [
  "weekly-changelog",
  "daily-twitter",
  "monthly-blog",
  "biweekly-linkedin",
];

describe("schedule presets", () => {
  test("all four presets are defined", () => {
    expect(SCHEDULE_PRESETS.map((preset) => preset.id).sort()).toEqual(
      [...PRESET_IDS].sort()
    );
  });

  test.each(PRESET_IDS)("preset %s produces a valid schedule payload", (id) => {
    const preset = getPresetScheduleValues(id);
    const parsed = scheduleFormSchema.safeParse({
      name: "Preset QA",
      outputType: preset.outputType,
      instructions: "",
      schedule: preset.schedule,
      repositoryIds: ["repo_123"],
      lookbackWindow: preset.lookbackWindow,
      brandVoiceId: "",
      autoPublish: false,
    });
    expect(parsed.success).toBe(true);
  });

  test("presets carry the expected output type, cadence and lookback", () => {
    expect(getPresetScheduleValues("weekly-changelog")).toMatchObject({
      outputType: "changelog",
      schedule: { frequency: "weekly", dayOfWeek: 1, hour: 9, minute: 0 },
      lookbackWindow: "last_7_days",
    });
    expect(getPresetScheduleValues("daily-twitter")).toMatchObject({
      outputType: "twitter_post",
      schedule: { frequency: "daily", hour: 9, minute: 0 },
      lookbackWindow: "yesterday",
    });
    expect(getPresetScheduleValues("monthly-blog")).toMatchObject({
      outputType: "blog_post",
      schedule: { frequency: "monthly", dayOfMonth: 1, hour: 9, minute: 0 },
      lookbackWindow: "last_30_days",
    });
    const before = toUtcDateString(new Date());
    const biweekly = getPresetScheduleValues("biweekly-linkedin");
    const after = toUtcDateString(new Date());
    expect(biweekly).toMatchObject({
      outputType: "linkedin_post",
      schedule: {
        frequency: "custom",
        intervalDays: 14,
        hour: 9,
        minute: 0,
      },
      lookbackWindow: "last_14_days",
    });
    // before/after window absorbs a UTC-midnight rollover between the calls.
    const anchorDate =
      biweekly.schedule.frequency === "custom"
        ? biweekly.schedule.anchorDate
        : undefined;
    expect(anchorDate).toBeDefined();
    expect([before, after]).toContain(anchorDate as string);
    expect(anchorDate as string).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("unknown preset id throws", () => {
    expect(() =>
      getPresetScheduleValues("does-not-exist" as SchedulePresetId)
    ).toThrow("Unknown schedule preset");
  });
});

const EMPTY_QUERY: SchedulePresetQueryConfig = {
  outputType: null,
  frequency: null,
  hour: null,
  minute: null,
  dayOfWeek: null,
  dayOfMonth: null,
  intervalDays: null,
  lookback: null,
};

describe("schedule preset shareable URLs", () => {
  test.each(PRESET_IDS)("preset %s round-trips through query state", (id) => {
    const query = schedulePresetToQuery(id);
    const values = schedulePresetQueryToValues(query);
    const expected = getPresetScheduleValues(id);
    expect(values).not.toBeNull();
    expect(values?.outputType).toBe(expected.outputType);
    expect(values?.lookbackWindow).toBe(expected.lookbackWindow);
    // anchorDate is stamped as "today" independently by each helper, so it
    // can differ across a UTC-midnight rollover: compare stable fields only.
    const { anchorDate: _actualAnchor, ...actualSchedule } =
      values?.schedule ?? {};
    const { anchorDate: _expectedAnchor, ...expectedSchedule } =
      expected.schedule;
    expect(actualSchedule).toMatchObject(expectedSchedule);
    if (values?.schedule.frequency === "custom") {
      expect(values.schedule.anchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test.each(PRESET_IDS)(
    "preset %s query values produce a valid schedule payload",
    (id) => {
      const values = schedulePresetQueryToValues(schedulePresetToQuery(id));
      expect(values).not.toBeNull();
      const parsed = scheduleFormSchema.safeParse({
        name: "Preset QA",
        outputType: values?.outputType,
        instructions: "",
        schedule: values?.schedule,
        repositoryIds: ["repo_123"],
        lookbackWindow: values?.lookbackWindow,
        brandVoiceId: "",
        autoPublish: false,
      });
      expect(parsed.success).toBe(true);
    }
  );

  test("empty query has no preset config and yields no values", () => {
    expect(hasSchedulePresetQueryConfig(EMPTY_QUERY)).toBe(false);
    expect(schedulePresetQueryToValues(EMPTY_QUERY)).toBeNull();
  });

  test("partial query counts as preset state but yields no values", () => {
    const partial = { ...EMPTY_QUERY, outputType: "changelog" as const };
    expect(hasSchedulePresetQueryConfig(partial)).toBe(true);
    expect(schedulePresetQueryToValues(partial)).toBeNull();
  });

  test("out-of-range or incomplete query values yield no values", () => {
    const base = schedulePresetToQuery("weekly-changelog");
    expect(schedulePresetQueryToValues({ ...base, hour: 25 })).toBeNull();
    expect(schedulePresetQueryToValues({ ...base, minute: 60 })).toBeNull();
    expect(
      schedulePresetQueryToValues({ ...base, dayOfWeek: null })
    ).toBeNull();
    const monthly = schedulePresetToQuery("monthly-blog");
    expect(
      schedulePresetQueryToValues({ ...monthly, dayOfMonth: 32 })
    ).toBeNull();
    const biweekly = schedulePresetToQuery("biweekly-linkedin");
    expect(
      schedulePresetQueryToValues({ ...biweekly, intervalDays: null })
    ).toBeNull();
    // Shared custom-interval bounds are 2–90 days; stale URLs outside them
    // must not reach the dialog.
    expect(
      schedulePresetQueryToValues({ ...biweekly, intervalDays: 1 })
    ).toBeNull();
    expect(
      schedulePresetQueryToValues({ ...biweekly, intervalDays: 91 })
    ).toBeNull();
  });

  test("unknown preset id throws when serializing to query", () => {
    expect(() =>
      schedulePresetToQuery("does-not-exist" as SchedulePresetId)
    ).toThrow("Unknown schedule preset");
  });
});
