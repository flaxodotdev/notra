import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import type { SiteManifestFile } from "@notra/sites-core/types/deployment";

import { injectAnalyticsScript } from "./analytics";
import {
  ASSET_SEGMENT,
  EDGE_CACHE_ORIGIN,
  IMMUTABLE_CACHE_CONTROL,
  PREVIEW_CACHE_CONTROL,
  REVALIDATE_CACHE_CONTROL,
} from "./constants/responses";
import { serviceErrorPage } from "./pages";
import type { ServeFileParams } from "./types/serving";
import type { SitesDeps } from "./types/worker";
import { html } from "./utils/responses";

function fileCacheControl(file: SiteManifestFile, isPreview: boolean): string {
  if (isPreview) {
    return PREVIEW_CACHE_CONTROL;
  }
  return file.path.includes(ASSET_SEGMENT)
    ? IMMUTABLE_CACHE_CONTROL
    : REVALIDATE_CACHE_CONTROL;
}

async function readFileBody(
  deps: SitesDeps,
  siteId: string,
  deploymentId: string,
  file: SiteManifestFile
): Promise<ReadableStream | null> {
  const cacheKey = `${EDGE_CACHE_ORIGIN}/${siteId}/${deploymentId}${file.path}`;
  const cached = await deps.cache?.match(cacheKey);
  if (cached?.body) {
    return cached.body;
  }
  const object = await deps.bucket.get(
    SITE_R2_KEYS.file(siteId, deploymentId, file.path)
  );
  if (!(object?.body && deps.cache)) {
    return object?.body ?? null;
  }
  const [forClient, forCache] = object.body.tee();
  deps.waitUntil(
    deps.cache.put(
      cacheKey,
      new Response(forCache, {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": IMMUTABLE_CACHE_CONTROL,
        },
      })
    )
  );
  return forClient;
}

export async function serveFile(params: ServeFileParams): Promise<Response> {
  const { deps, request, siteId, deploymentId, file, status, isPreview } =
    params;
  const analytics =
    status === 200 && file.contentType.startsWith("text/html")
      ? (params.analytics ?? null)
      : null;
  // The injected tag changes the body, so it must change the validator too.
  const etag = analytics ? `"${file.sha256}-a"` : `"${file.sha256}"`;
  const headers = new Headers({
    "Content-Type": file.contentType,
    "Cache-Control": fileCacheControl(file, isPreview),
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (
    params.contentSecurityPolicy &&
    file.contentType.startsWith("text/html")
  ) {
    headers.set("Content-Security-Policy", params.contentSecurityPolicy);
  }
  for (const [name, value] of Object.entries(params.extraHeaders ?? {})) {
    headers.set(name, value);
  }
  const servedType = headers.get("Content-Type") ?? "";
  if (
    params.llmsLink &&
    (servedType.startsWith("text/html") ||
      servedType.startsWith("text/markdown"))
  ) {
    headers.append("Link", params.llmsLink);
  }
  if (isPreview) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  if (status === 200 && request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const body = await readFileBody(deps, siteId, deploymentId, file);
  if (!body) {
    return html(serviceErrorPage(), 503);
  }
  const response = new Response(request.method === "HEAD" ? null : body, {
    status,
    headers,
  });
  return analytics && request.method !== "HEAD"
    ? injectAnalyticsScript(response, analytics.scriptSrc, analytics.eventPath)
    : response;
}
