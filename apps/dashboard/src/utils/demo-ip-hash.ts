import { createHmac } from "node:crypto";

import {
  getRailwayClientIp,
  ipNetworkKey,
  parseIp,
} from "@notra/utils/client-ip";

/**
 * The visitor's network for demo rate limits. The demo is self-hosted behind
 * Cloudflare and Railway, where the shared ratelimit helper (Vercel only)
 * would hand every request a fresh random key. `x-vercel-forwarded-for` is
 * only trusted on Vercel: elsewhere any client could send it through
 * Cloudflare to dodge the per-network limit. IPv6 visitors are grouped by
 * their /64, which a single subscriber controls entirely.
 */
export function getDemoClientIp(headersList: Headers): string {
  const vercelIp =
    process.env.VERCEL === "1"
      ? parseIp(headersList.get("x-vercel-forwarded-for") ?? "")
      : null;
  const ip = vercelIp ?? getRailwayClientIp(headersList);
  return ip ? ipNetworkKey(ip) : "unknown";
}

/** Rate-limit key for sandbox creation; the raw IP is never stored. */
export function hashDemoClientIp(ip: string): string {
  const secret = process.env.WORKOS_COOKIE_PASSWORD;
  if (!secret) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be defined");
  }
  // Domain-separated so this MAC over visitor-chosen input can never collide
  // with another use of the same secret.
  return createHmac("sha256", secret)
    .update(`demo-ip:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
