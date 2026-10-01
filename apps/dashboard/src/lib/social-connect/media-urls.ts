import { getOptionalR2PublicUrl } from "@/lib/upload/r2";

import { SocialConnectRequestError } from "./errors";

function allowedMediaHosts(): Set<string> {
  const hosts = new Set<string>();
  const values = [
    getOptionalR2PublicUrl(),
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const value of values) {
    if (!value) {
      continue;
    }
    try {
      hosts.add(new URL(value).hostname.toLowerCase());
    } catch {
      // ignore malformed env — the host simply stays disallowed
    }
  }
  return hosts;
}

// ponytail: UI only sends uploaded URLs, but the API takes any URL and hands
// it to PostForMe's fetcher. Confine that to our own storage + app hosts.
export function assertAllowedSocialMediaUrls(urls: string[] | undefined) {
  if (!urls?.length) {
    return;
  }
  const hosts = allowedMediaHosts();
  for (const raw of urls) {
    // PostForMe fetches the URL server-side, so app-relative paths can never
    // resolve there. Reject early instead of failing at delivery.
    if (raw.startsWith("/") || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      throw new SocialConnectRequestError({
        message: "Media URL must be an absolute URL",
        cause: null,
      });
    }
    let hostname: string;
    try {
      hostname = new URL(raw).hostname.toLowerCase();
    } catch {
      throw new SocialConnectRequestError({
        message: "Invalid media URL",
        cause: null,
      });
    }
    if (!hosts.has(hostname)) {
      throw new SocialConnectRequestError({
        message: "Media URL host is not allowed",
        cause: null,
      });
    }
  }
}
