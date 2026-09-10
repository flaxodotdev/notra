import type { ScheduleOutputType } from "@notra/schemas/dashboard/integrations";

import { AGENT_CONTENT_TASK_TYPES } from "@/constants/agent-content";
import { generateContentViaAgentTask } from "@/lib/agent/content-task";
import { isAgentContentGenerationEnabled } from "@/lib/agent/flag";

import type {
  ContentGenerationContext,
  ContentGenerationResult,
  ContentHandler,
} from "../types";
import { handleBlogPost } from "./blog-post";
import { handleChangelog } from "./changelog";
import { handleImage } from "./image";
import { handleLinkedIn } from "./linkedin";
import { handleTwitter } from "./twitter";

const handlers: Record<ScheduleOutputType, ContentHandler> = {
  changelog: handleChangelog,
  blog_post: handleBlogPost,
  linkedin_post: handleLinkedIn,
  twitter_post: handleTwitter,
  image: handleImage,
};

export async function generateScheduledContent(
  outputType: string,
  ctx: ContentGenerationContext
): Promise<ContentGenerationResult> {
  // Callers always set promptInput.tone, so promptInput is the source of
  // truth downstream.
  const promptInput = ctx.promptInput;
  const normalizedCtx: ContentGenerationContext = { ...ctx, promptInput };
  if (isAgentContentGenerationEnabled() && isScheduleOutputType(outputType)) {
    const taskType = AGENT_CONTENT_TASK_TYPES[outputType];
    if (taskType) {
      return generateContentViaAgentTask({
        organizationId: ctx.organizationId,
        collectionId: ctx.collectionId,
        contentType: taskType.contentType,
        contentLabel: taskType.contentLabel,
        brandAgentType: taskType.brandAgentType,
        repositories: ctx.repositories,
        linearIntegrations: ctx.linearIntegrations,
        promptInput,
        sourceMetadata: ctx.sourceMetadata,
        dataPointSettings: ctx.dataPointSettings,
        selectionFilters: ctx.selectionFilters,
        commitWindow: ctx.commitWindow,
        autoPublish: ctx.autoPublish,
        voiceId: ctx.voiceId,
        chargeAiCredits: ctx.chargeAiCredits,
      });
    }
  }

  const handler = isScheduleOutputType(outputType)
    ? handlers[outputType]
    : null;

  if (!handler) {
    console.log(
      `[Schedule] Output type ${outputType} not fully implemented yet`
    );
    return {
      status: "unsupported_output_type",
      outputType,
    };
  }

  return handler(normalizedCtx);
}

function isScheduleOutputType(value: string): value is ScheduleOutputType {
  return value in handlers;
}
