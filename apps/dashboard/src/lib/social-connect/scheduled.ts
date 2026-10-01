import { db } from "@notra/db/drizzle";
import { connectedSocialAccounts } from "@notra/db/schema";
import { socialConnectPlatformSchema } from "@notra/schemas/dashboard/social-accounts";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import type PostForMe from "post-for-me";

import { SOCIAL_POST_EXTERNAL_ID_PREFIX } from "@/constants/social-connect";
import {
  getSocialConnectClient,
  isSocialConnectConfigured,
} from "@/lib/social-connect/client";
import {
  SocialConnectConfigError,
  SocialConnectRequestError,
} from "@/lib/social-connect/errors";
import { assertAllowedSocialMediaUrls } from "@/lib/social-connect/media-urls";
import type {
  ScheduledSocialPost,
  ScheduledSocialPostParams,
  UpdateScheduledSocialPostParams,
} from "@/types/services/social-connect";

interface AccountConnection {
  accountId: string;
  provider: "twitter" | "linkedin";
  providerAccountId: string;
  client: PostForMe;
}

function loadConnection(params: { organizationId: string; accountId: string }) {
  return Effect.gen(function* () {
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
          columns: {
            provider: true,
            providerAccountId: true,
            username: true,
          },
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

    const connection: AccountConnection = {
      accountId: params.accountId,
      provider: parsedPlatform.data,
      providerAccountId: account.providerAccountId,
      client: getSocialConnectClient(parsedPlatform.data),
    };
    return connection;
  });
}

function isOurs(externalId: string | null): boolean {
  return (
    typeof externalId === "string" &&
    externalId.startsWith(SOCIAL_POST_EXTERNAL_ID_PREFIX)
  );
}

// Terminal = delivered or dead. `processed` is what publish.ts returns for a
// completed immediate post, and PostForMe uses it the same way for scheduled
// posts that already delivered. In-flight posts report `scheduled`,
// `processing`, etc. and stay visible.
const TERMINAL_SCHEDULED_STATUSES = new Set([
  "processed",
  "published",
  "failed",
  "error",
  "cancelled",
  "canceled",
  "deleted",
  "completed",
]);

function belongsToAccount(
  post: SocialPostLike,
  providerAccountId: string
): boolean {
  return (post.social_accounts ?? []).some(
    (account) => account?.id === providerAccountId
  );
}

function assertOwnedByAccount(post: SocialPostLike, providerAccountId: string) {
  return Effect.gen(function* () {
    if (
      !isOurs(post.external_id ?? null) ||
      !belongsToAccount(post, providerAccountId)
    ) {
      return yield* Effect.fail(
        new SocialConnectRequestError({
          message: "Scheduled post not found",
          cause: null,
        })
      );
    }
  });
}

interface SocialPostLike {
  id: string;
  caption?: string | null;
  external_id?: string | null;
  media?: Array<{ url?: string }> | null;
  status?: string;
  scheduled_at?: string | null;
  social_accounts?: Array<{ id?: string }>;
  platform_data?: { id?: string; url?: string } | null;
}

function toScheduledPost(
  post: SocialPostLike,
  provider: string
): ScheduledSocialPost {
  const media = Array.isArray(post.media) ? post.media : [];
  return {
    postId: post.id,
    platform: provider,
    status: post.status ?? "unknown",
    scheduledAt: post.scheduled_at ?? null,
    caption: post.caption ?? "",
    mediaUrls: media
      .map((item) => (typeof item?.url === "string" ? item.url : null))
      .filter((url): url is string => url !== null),
    platformPostId: post.platform_data?.id ?? null,
    postUrl: post.platform_data?.url ?? null,
  };
}

function assertScheduledAtFuture(scheduledAt: string) {
  return Effect.gen(function* () {
    const time = Date.parse(scheduledAt);
    if (Number.isNaN(time) || time <= Date.now()) {
      return yield* Effect.fail(
        new SocialConnectRequestError({
          message: "Scheduled time must be in the future",
          cause: null,
        })
      );
    }
  });
}

export const listScheduledSocialPosts = Effect.fn("listScheduledSocialPosts")(
  function* (params: {
    organizationId: string;
    accountId: string;
    externalId: string;
  }) {
    const connection = yield* loadConnection(params);

    const response = yield* Effect.tryPromise({
      try: () =>
        connection.client.socialPosts.list({
          external_id: [params.externalId],
          limit: 20,
        }),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Failed to load scheduled posts",
          cause,
        }),
    });

    const items = Array.isArray(response?.data) ? response.data : [];
    return items
      .filter(
        (post: SocialPostLike) =>
          belongsToAccount(post, connection.providerAccountId) &&
          !TERMINAL_SCHEDULED_STATUSES.has(
            (post.status ?? "unknown").toLowerCase()
          )
      )
      .sort((a: SocialPostLike, b: SocialPostLike) => {
        const timeA = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.NaN;
        const timeB = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.NaN;
        return (
          (Number.isNaN(timeB) ? -Infinity : timeB) -
          (Number.isNaN(timeA) ? -Infinity : timeA)
        );
      })
      .map((post: SocialPostLike) =>
        toScheduledPost(post, connection.provider)
      );
  }
);

export const updateScheduledSocialPost = Effect.fn("updateScheduledSocialPost")(
  function* (params: UpdateScheduledSocialPostParams) {
    const connection = yield* loadConnection(params);

    if (params.scheduledAt) {
      yield* assertScheduledAtFuture(params.scheduledAt);
    }

    try {
      assertAllowedSocialMediaUrls(params.mediaUrls);
    } catch (error) {
      return yield* Effect.fail(error as SocialConnectRequestError);
    }

    const current = yield* Effect.tryPromise({
      try: () => connection.client.socialPosts.retrieve(params.postId),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Scheduled post not found",
          cause,
        }),
    });

    yield* assertOwnedByAccount(current, connection.providerAccountId);

    const currentMedia = Array.isArray(current.media) ? current.media : [];
    const sanitizedCurrentMedia = currentMedia
      .map((item) =>
        typeof item?.url === "string" && item.url.length > 0
          ? { url: item.url }
          : null
      )
      .filter((item): item is { url: string } => item !== null);
    const updated = yield* Effect.tryPromise({
      try: () =>
        connection.client.socialPosts.update(params.postId, {
          caption: params.content ?? current.caption,
          social_accounts: [connection.providerAccountId],
          media:
            params.mediaUrls !== undefined
              ? params.mediaUrls.map((url) => ({ url }))
              : sanitizedCurrentMedia,
          ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
        }),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Failed to update scheduled post",
          cause,
        }),
    });

    return toScheduledPost(updated, connection.provider);
  }
);

export const cancelScheduledSocialPost = Effect.fn("cancelScheduledSocialPost")(
  function* (params: ScheduledSocialPostParams) {
    const connection = yield* loadConnection(params);

    const current = yield* Effect.tryPromise({
      try: () => connection.client.socialPosts.retrieve(params.postId),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Scheduled post not found",
          cause,
        }),
    });

    yield* assertOwnedByAccount(current, connection.providerAccountId);

    yield* Effect.tryPromise({
      try: () => connection.client.socialPosts.delete(params.postId),
      catch: (cause) =>
        new SocialConnectRequestError({
          message: "Failed to cancel scheduled post",
          cause,
        }),
    });

    return { success: true };
  }
);
