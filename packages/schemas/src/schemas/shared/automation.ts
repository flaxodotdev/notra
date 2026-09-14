import "zod/compile";
import {
  CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS,
  CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS,
  SCHEDULE_ANCHOR_DATE_PATTERN,
} from "@notra/ai/constants/schedule-interval";
import { z } from "zod";

export const webhookEventTypeSchema = z.enum(["release", "push"]);
export const cronFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "custom",
]);
export const cronIntervalDaysSchema = z
  .number()
  .int()
  .min(CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS)
  .max(CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS);
export const cronAnchorDateSchema = z
  .string()
  .regex(SCHEDULE_ANCHOR_DATE_PATTERN, "Expected YYYY-MM-DD");

export const MAX_IGNORE_COMMIT_PATTERNS = 10;
export const MAX_IGNORE_COMMIT_PATTERN_LENGTH = 120;

const ignoreCommitPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_IGNORE_COMMIT_PATTERN_LENGTH)
  .refine((value) => {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }, "Invalid regular expression");

export const eventTriggerSourceConfigSchema = z.object({
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  includePreReleases: z.boolean().default(true),
  ignoreCommitPatterns: z
    .array(ignoreCommitPatternSchema)
    .max(MAX_IGNORE_COMMIT_PATTERNS)
    .default([]),
});
