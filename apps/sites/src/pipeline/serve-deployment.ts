import { Effect, Option } from "effect";

import { DEPLOYMENT_ROUTES } from "../constants/routes";
import { loadManifest, StateUnavailableError } from "../loaders";
import { isReportablePageView, reportTraffic } from "../traffic";
import type { ResolvedDeployment, SiteRequestContext } from "../types/serving";
import { runRoutes } from "../utils/run-routes";
import { serveManifest } from "./serve-manifest";

export const serveDeployment = Effect.fn("Sites.serveDeployment")(function* (
  context: SiteRequestContext,
  resolved: ResolvedDeployment
) {
  const { deps, request, url, host } = context;
  const { siteId, deploymentId, trafficToken } = resolved;
  const loaded = yield* Effect.promise(() =>
    loadManifest(deps, siteId, deploymentId)
  );
  if (!loaded) {
    return yield* Effect.die(
      new StateUnavailableError(
        `Manifest missing for active deployment ${deploymentId}`
      )
    );
  }
  const deploymentContext = { ...context, resolved, loaded };
  const answered = yield* runRoutes(DEPLOYMENT_ROUTES, deploymentContext);
  if (Option.isSome(answered)) {
    return answered.value;
  }
  const response = yield* serveManifest(deploymentContext);
  if (
    trafficToken &&
    deps.trafficIngestUrl &&
    isReportablePageView(request, response, deps.dashboardUrl)
  ) {
    const { publicOrigin } = loaded.manifest.target;
    deps.waitUntil(
      reportTraffic({
        fetch: deps.fetch,
        ingestUrl: deps.trafficIngestUrl,
        token: trafficToken,
        request,
        publicUrl: new URL(`${url.pathname}${url.search}`, publicOrigin).href,
        proxied: new URL(publicOrigin).hostname !== host,
        status: response.status,
      })
    );
  }
  return response;
});
