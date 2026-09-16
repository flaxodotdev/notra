import "zod/compile";
import { splitIgnoreCommitPatternsText } from "@notra/ai/utils/ignore-commit-patterns";
import {
  isUnsafeIgnoreCommitPattern,
  isValidIgnoreCommitPattern,
  MAX_IGNORE_COMMIT_PATTERN_LENGTH,
  MAX_IGNORE_COMMIT_PATTERNS,
  SUPPORTED_AUTOMATION_OUTPUT_TYPES,
  WEBHOOK_EVENT_TYPES,
} from "@notra/schemas/dashboard/integrations";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import * as z from "zod";

export const IGNORE_COMMIT_PATTERNS_TEXT_MAX_LENGTH =
  MAX_IGNORE_COMMIT_PATTERNS * (MAX_IGNORE_COMMIT_PATTERN_LENGTH + 2);

export const eventTriggerFormSchema = z
  .object({
    eventType: z.enum(WEBHOOK_EVENT_TYPES),
    outputType: z.enum(SUPPORTED_AUTOMATION_OUTPUT_TYPES),
    repositoryIds: z.array(z.string()).min(1, "Select at least one repository"),
    brandVoiceId: z.string(),
    autoPublish: z.boolean(),
    includePreReleases: z.boolean(),
    ignoreCommitPatternsText: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.eventType !== "push") {
      return;
    }
    if (
      value.ignoreCommitPatternsText.length >
      IGNORE_COMMIT_PATTERNS_TEXT_MAX_LENGTH
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Must be ${IGNORE_COMMIT_PATTERNS_TEXT_MAX_LENGTH} characters or less`,
        path: ["ignoreCommitPatternsText"],
      });
      return;
    }
    const lines = splitIgnoreCommitPatternsText(value.ignoreCommitPatternsText);
    if (lines.length > MAX_IGNORE_COMMIT_PATTERNS) {
      ctx.addIssue({
        code: "custom",
        message: `Max ${MAX_IGNORE_COMMIT_PATTERNS} patterns`,
        path: ["ignoreCommitPatternsText"],
      });
      return;
    }
    for (const line of lines) {
      if (line.length > MAX_IGNORE_COMMIT_PATTERN_LENGTH) {
        ctx.addIssue({
          code: "custom",
          message: `Each pattern must be ${MAX_IGNORE_COMMIT_PATTERN_LENGTH} characters or less`,
          path: ["ignoreCommitPatternsText"],
        });
        return;
      }
      if (!isValidIgnoreCommitPattern(line)) {
        ctx.addIssue({
          code: "custom",
          message: `Not a valid regex: ${line}`,
          path: ["ignoreCommitPatternsText"],
        });
        return;
      }
      if (isUnsafeIgnoreCommitPattern(line)) {
        ctx.addIssue({
          code: "custom",
          message: `This regex could hang the server: ${line}`,
          path: ["ignoreCommitPatternsText"],
        });
        return;
      }
    }
  });

export type EventTriggerFormValues = z.infer<typeof eventTriggerFormSchema>;
