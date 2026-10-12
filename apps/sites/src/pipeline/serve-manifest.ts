import {
  joinMountPath,
  resolveAreaForPath,
} from "@notra/sites-core/utils/mounts";
import { Effect, Option } from "effect";

import { MANIFEST_ROUTES } from "../constants/routes";
import { notFoundPage } from "../pages";
import type { DeploymentRouteContext } from "../types/routes";
import { analyticsScriptTag } from "../utils/analytics-tag";
import { html } from "../utils/responses";
import {
  llmsLinkHeader,
  markdownTwin,
  normalizeRequestPath,
  prefersMarkdown,
  resolveFile,
} from "../utils/routing";
import { runRoutes } from "../utils/run-routes";

export const serveManifest = Effect.fn("Sites.serveManifest")(function* (
  context: DeploymentRouteContext
) {
  const { deps, request, url, resolved, loaded } = context;
  const path = normalizeRequestPath(url.pathname);
  if (path === null) {
    return html(notFoundPage(), 400);
  }
  const area = resolveAreaForPath(loaded.manifest.target.mounts, path);
  const file = resolveFile(loaded.files, path);
  const answered = yield* runRoutes(MANIFEST_ROUTES, {
    ...context,
    path,
    area,
    markdownNotFoundPath: joinMountPath(area?.mount ?? "/", "404.md"),
    wantsMarkdown: prefersMarkdown(request.headers.get("accept")),
    file,
    twin: file ? markdownTwin(loaded.files, file) : null,
    fileParams: {
      deps,
      request,
      siteId: resolved.siteId,
      deploymentId: resolved.deploymentId,
      isPreview: resolved.isPreview,
      contentSecurityPolicy: loaded.manifest.contentSecurityPolicy,
      analytics: resolved.isPreview
        ? null
        : analyticsScriptTag(resolved, loaded, url.pathname),
      llmsLink: llmsLinkHeader(loaded.files, area?.mount ?? "/"),
      status: 200,
    },
  });
  return Option.getOrElse(answered, () => html(notFoundPage(), 404));
});
