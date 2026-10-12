import { Effect, Option } from "effect";

import {
  analyticsScriptResponse,
  isAnalyticsEventPath,
  readAnalyticsEvent,
  reportEngagement,
} from "../analytics";
import { analyticsAccepted } from "../responses/analytics-accepted";
import { methodNotAllowed } from "../responses/method-not-allowed";
import type { DeploymentRouteContext } from "../types/routes";
import { analyticsScriptTag } from "../utils/analytics-tag";

export const analyticsEndpointsRoute = Effect.fn(
  "Sites.route.analyticsEndpoints"
)(function* ({ deps, request, url, resolved, loaded }: DeploymentRouteContext) {
  const tag = analyticsScriptTag(resolved, loaded, url.pathname);
  const isScript = tag !== null && url.pathname === tag.scriptSrc;
  const isEvent = isAnalyticsEventPath(url.pathname);
  if (!(isScript || isEvent)) {
    return Option.none<Response>();
  }
  if (isScript) {
    return Option.some(
      request.method === "POST"
        ? methodNotAllowed("GET, HEAD")
        : analyticsScriptResponse()
    );
  }
  if (request.method !== "POST") {
    return Option.some(methodNotAllowed("POST"));
  }
  const event =
    tag !== null && url.pathname === tag.eventPath
      ? yield* Effect.promise(() => readAnalyticsEvent(request))
      : null;
  if (event && resolved.trafficToken && deps.trafficIngestUrl) {
    deps.waitUntil(
      reportEngagement({
        fetch: deps.fetch,
        ingestUrl: deps.trafficIngestUrl,
        token: resolved.trafficToken,
        publicOrigin: loaded.manifest.target.publicOrigin,
        event,
      })
    );
  }
  return Option.some(analyticsAccepted());
});
