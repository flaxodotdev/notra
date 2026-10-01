import { recordDemoPublishedPost } from "@notra/ai/utils/demo-social";
import { db } from "@notra/db/drizzle";
import { connectedSocialAccounts } from "@notra/db/schema";
import { socialConnectPlatformSchema } from "@notra/schemas/dashboard/social-accounts";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { SocialPostResult } from "post-for-me/resources/social-post-results";

import { SOCIAL_POST_EXTERNAL_ID_PREFIX } from "@/constants/social-connect";
import { recordPublishedSocialPost } from "@/lib/analytics/record-post";
import {
  getSocialConnectClient,
  isSocialConnectConfigured,
} from "@/lib/social-connect/client";
import {
  SocialConnectConfigError,
  SocialConnectRequestError,
} from "@/lib/social-connect/errors";
import { assertAllowedSocialMediaUrls } from "@/lib/social-connect/media-urls";
import type { PublishSocialPostParams } from "@/types/services/social-connect";

const RESULT_POLL_ATTEMPTS = 5;
const RESULT_POLL_DELAY = "2 seconds";

function getResultErrorMessage(result: SocialPostResult): string {
  const { error } = result;
  if (typeof error === "string" && error) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }
  return "The platform rejected the post";
}

/**
 * The demo's accounts are fictional: publishing succeeds without reaching a
 * platform and the post shows up in analytics with generated stats, so the
 * flow can be tried end to end.
 */
const publishDemoPost = Effect.fn("publishDemoPost")(function* (
  params: PublishSocialPostParams
) {
  const account = yield* Effect.tryPromise({
    try: () =>
      db.query.connectedSocialAccounts.findFirst({
        columns: { provider: true, providerAccountId: true, username: true },
        where: and(
          eq(connectedSocialAccounts.id, params.accountId),
          eq(connectedSocialAccounts.organizationId, params.organizationId)
        ),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to load connected account",
        cause,
      }),
  });
  if (!account) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: "Connected account not found",
        cause: null,
      })
    );
  }
  const platformPostId = `demo-${crypto.randomUUID()}`;
  yield* Effect.tryPromise({
    try: () =>
      recordDemoPublishedPost(params.organizationId, {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        platformPostId,
        content: params.content,
        postedAt: new Date().toISOString(),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to publish post",
        cause,
      }),
  });
  return {
    postId: platformPostId,
    platformPostId,
    postUrl: null,
    username: account.username,
    platform: account.provider,
  };
});

export const publishSocialPost = Effect.fn("publishSocialPost")(function* (
  params: PublishSocialPostParams
) {
  if (isDemoMode()) {
    return yield* publishDemoPost(params);
  }
  if (!isSocialConnectConfigured()) {
    return yield* Effect.fail(
      new SocialConnectConfigError({
        message: "Social account linking is not configured",
      })
    );
  }

  const account = yield* Effect.tryPromise({
    try: () =>
      db.query.connectedSocialAccounts.findFirst({
        columns: { provider: true, providerAccountId: true, username: true },
        where: and(
          eq(connectedSocialAccounts.id, params.accountId),
          eq(connectedSocialAccounts.organizationId, params.organizationId)
        ),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to load connected account",
        cause,
      }),
  });

  if (!account) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: "Connected account not found",
        cause: null,
      })
    );
  }

  const parsedPlatform = socialConnectPlatformSchema.safeParse(
    account.provider
  );
  if (!parsedPlatform.success) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: "This account's platform is not supported",
        cause: null,
      })
    );
  }
  const client = getSocialConnectClient(parsedPlatform.data);

  if (params.scheduledAt) {
    const scheduledTime = Date.parse(params.scheduledAt);
    if (Number.isNaN(scheduledTime) || scheduledTime <= Date.now()) {
      return yield* Effect.fail(
        new SocialConnectRequestError({
          message: "Scheduled time must be in the future",
          cause: null,
        })
      );
    }
  }

  if (params.externalId) {
    if (!params.externalId.startsWith(SOCIAL_POST_EXTERNAL_ID_PREFIX)) {
      return yield* Effect.fail(
        new SocialConnectRequestError({
          message: "Invalid external id",
          cause: null,
        })
      );
    }
    // Content-form ids embed the owning account (`notra:{contentId}:{accountId}`;
    // nanoids never contain colons). Reject ids minted for another account —
    // they would schedule under the caller's provider account but never be
    // manageable through the owner's UI. Adhoc ids carry no account segment.
    const suffix = params.externalId.slice(
      SOCIAL_POST_EXTERNAL_ID_PREFIX.length
    );
    const segments = suffix.split(":");
    const adhocShape =
      segments.length === 2 &&
      segments[0] === "adhoc" &&
      /^[A-Za-z0-9_-]+$/.test(segments[1] ?? "");
    // The content segment is not charset-checked: account equality is the
    // binding constraint, and legacy ids must keep working.
    const contentShape =
      segments.length === 2 &&
      (segments[0]?.length ?? 0) > 0 &&
      segments[1] === params.accountId;
    if (!(adhocShape || contentShape)) {
      return yield* Effect.fail(
        new SocialConnectRequestError({
          message: "Invalid external id",
          cause: null,
        })
      );
    }
  }

  try {
    assertAllowedSocialMediaUrls(params.mediaUrls);
  } catch (error) {
    return yield* Effect.fail(error as SocialConnectRequestError);
  }

  const post = yield* Effect.tryPromise({
    try: () =>
      client.socialPosts.create({
        caption: params.content,
        social_accounts: [account.providerAccountId],
        ...(params.mediaUrls?.length
          ? { media: params.mediaUrls.map((url) => ({ url })) }
          : {}),
        ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
        ...(params.externalId ? { external_id: params.externalId } : {}),
      }),
    catch: (cause) =>
      new SocialConnectRequestError({
        message: "Failed to publish post",
        cause,
      }),
  });

  if (params.scheduledAt) {
    return {
      postId: post.id,
      platformPostId: null,
      postUrl: null,
      username: account.username,
      platform: account.provider,
      scheduledAt: params.scheduledAt,
      status: "scheduled" as const,
    };
  }

  let postResult: SocialPostResult | null = null;
  for (let attempt = 0; attempt < RESULT_POLL_ATTEMPTS; attempt += 1) {
    yield* Effect.sleep(RESULT_POLL_DELAY);
    const results = yield* Effect.tryPromise({
      try: () => client.socialPostResults.list({ post_id: [post.id] }),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Failed to load published post",
          cause,
        }),
    }).pipe(Effect.catch(() => Effect.succeed(null)));

    postResult = results?.data.at(0) ?? null;
    if (postResult) {
      break;
    }
  }

  if (postResult && !postResult.success) {
    return yield* Effect.fail(
      new SocialConnectRequestError({
        message: getResultErrorMessage(postResult),
        cause: null,
      })
    );
  }

  const platformPostId = postResult?.platform_data?.id ?? null;
  const platformPostUrl = postResult?.platform_data?.url ?? null;
  const postUrl =
    platformPostUrl ??
    (platformPostId && account.provider === "twitter"
      ? `https://x.com/${account.username}/status/${platformPostId}`
      : null);

  if (platformPostId) {
    yield* Effect.promise(() =>
      recordPublishedSocialPost({
        organizationId: params.organizationId,
        accountId: params.accountId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        platformPostId,
        url: postUrl,
        content: params.content,
      })
    );
  }

  return {
    postId: post.id,
    platformPostId,
    postUrl,
    username: account.username,
    platform: account.provider,
    scheduledAt: null,
    status: "processed" as const,
  };
});
