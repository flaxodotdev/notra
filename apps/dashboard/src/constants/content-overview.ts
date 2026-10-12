import { Tick02Icon } from "@hugeicons/core-free-icons";
import type { ContentResponse } from "@notra/schemas/dashboard/content";

import type { SiteStatusBadgeConfig } from "@/types/sites";

export const CONTENT_METADATA_DEBOUNCE_MS = 600;

/** Cover size hosted sites crop to (same as Open Graph images). */
export const CONTENT_COVER_WIDTH = 1200;
export const CONTENT_COVER_HEIGHT = 630;

/** Tag suggestions shown under the tags input. */
export const TAG_SUGGESTION_COUNT = 6;
/** Distinct tags the suggestions endpoint returns, most used first. */
export const TAG_SUGGESTIONS_LIMIT = 50;

/** Link fields on an author, in form order. */
export const CONTENT_AUTHOR_LINK_FIELDS = [
  "url",
  "x",
  "linkedin",
  "github",
] as const;

export const CONTENT_AUTHOR_SLUG_FALLBACK = "author";
/** Retries when another author takes the same slug during ensureSelf. */
export const CONTENT_AUTHOR_ENSURE_SELF_ATTEMPTS = 3;

export const TRAILING_DASHES = /-+$/;

/** Same badge language as site deployments: live is "ready", a draft is neutral. */
export const CONTENT_STATUS_BADGES = {
  published: { variant: "success", icon: Tick02Icon, square: true },
  draft: { variant: "secondary" },
} as const satisfies Record<ContentResponse["status"], SiteStatusBadgeConfig>;

/** Tabs of the post panel, in order. */
export const CONTENT_PANEL_TABS = [
  { id: "overview" },
  { id: "agent" },
] as const;
