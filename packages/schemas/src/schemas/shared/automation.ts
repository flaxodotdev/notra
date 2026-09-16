import "zod/compile";
import {
  CUSTOM_SCHEDULE_MAX_INTERVAL_DAYS,
  CUSTOM_SCHEDULE_MIN_INTERVAL_DAYS,
  SCHEDULE_ANCHOR_DATE_PATTERN,
} from "@notra/ai/constants/schedule-interval";
import {
  isUnsafeIgnoreCommitPattern,
  isValidIgnoreCommitPattern,
  MAX_IGNORE_COMMIT_PATTERN_LENGTH,
  MAX_IGNORE_COMMIT_PATTERNS,
  splitIgnoreCommitPatternsText,
} from "@notra/ai/utils/ignore-commit-patterns";
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

const ignoreCommitPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_IGNORE_COMMIT_PATTERN_LENGTH)
  .refine((value) => !/[\r\n]/.test(value), "Patterns can't span lines")
  .refine(
    (value) => splitIgnoreCommitPatternsText(value).length === 1,
    "Escape commas inside a pattern as \\,"
  )
  .refine(isValidIgnoreCommitPattern, "Not a valid regex")
  .refine(
    (value) => !isUnsafeIgnoreCommitPattern(value),
    "This regex could hang the server. Avoid nested quantifiers, lookarounds and backreferences"
  );

export {
  isUnsafeIgnoreCommitPattern,
  isValidIgnoreCommitPattern,
  MAX_IGNORE_COMMIT_PATTERN_LENGTH,
  MAX_IGNORE_COMMIT_PATTERNS,
};

export const eventTriggerSourceConfigSchema = z.object({
  eventTypes: z.array(webhookEventTypeSchema).min(1),
  includePreReleases: z.boolean().default(true),
  ignoreCommitPatterns: z
    .array(ignoreCommitPatternSchema)
    .max(MAX_IGNORE_COMMIT_PATTERNS)
    .refine(
      (patterns) => new Set(patterns).size === patterns.length,
      "Patterns must be unique"
    )
    .default([]),
});
