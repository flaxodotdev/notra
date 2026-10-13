import type { SocialVideoAttachment } from "@notra/schemas/types/dashboard/content";

import { getOptionalR2PublicUrl } from "@/lib/upload/r2";

import { SocialConnectRequestError } from "./errors";

function allowedMediaBaseUrl(): URL | null {
  // ponytail: R2 public origin only. App-origin media (`/api/uploads/...`)
  // requires dashboard auth, which PostForMe does not have — allowing the
  // app host would pass validation and fail at provider delivery.
  const value = getOptionalR2PublicUrl();
  if (!value) {
    return null;
  }
  try {
    return new URL(value);
  } catch {
    // Malformed configuration fails closed.
    return null;
  }
}

// ponytail: UI only sends uploaded URLs, but the API takes any URL and hands
// it to PostForMe's fetcher. Confine that to our own storage origin — and,
// when the caller is known, to its own `organization/{orgId}/` prefix, so one
// org cannot publish another org's objects to a provider.
export function assertAllowedSocialMediaUrls(
  urls: string[] | undefined,
  organizationId?: string
) {
  if (!urls?.length) {
    return;
  }
  const baseUrl = allowedMediaBaseUrl();
  for (const raw of urls) {
    // PostForMe fetches the URL server-side, so app-relative paths can never
    // resolve there. Reject early instead of failing at delivery.
    if (raw.startsWith("/") || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      throw new SocialConnectRequestError({
        message: "Media URL must be an absolute URL",
        cause: null,
      });
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new SocialConnectRequestError({
        message: "Invalid media URL",
        cause: null,
      });
    }
    // Origin covers scheme and port too: `ftp://` or another port on the
    // same host is not our storage.
    if (!baseUrl || url.origin !== baseUrl.origin) {
      throw new SocialConnectRequestError({
        message: "Media URL host is not allowed",
        cause: null,
      });
    }
    if (
      organizationId &&
      !url.pathname.startsWith(
        `${baseUrl.pathname.replace(/\/$/, "")}/organization/${organizationId}/`
      )
    ) {
      throw new SocialConnectRequestError({
        message: "Media URL belongs to another organization",
        cause: null,
      });
    }
  }
}

/** A video the organization uploaded itself, served from our storage. */
export function isOwnSocialVideo(
  video: SocialVideoAttachment,
  organizationId: string
): boolean {
  if (!video.key.startsWith(`organization/${organizationId}/`)) {
    return false;
  }
  try {
    assertAllowedSocialMediaUrls([video.url], organizationId);
    return true;
  } catch {
    return false;
  }
}
