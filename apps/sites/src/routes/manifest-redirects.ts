import { Effect, Option } from "effect";

import { manifestRedirect } from "../responses/redirects";
import type { ManifestRouteContext } from "../types/routes";
import { matchRedirect } from "../utils/routing";

export const manifestRedirectsRoute = ({
  path,
  loaded,
}: ManifestRouteContext): Effect.Effect<Option.Option<Response>> =>
  Effect.sync(() =>
    Option.map(
      Option.fromNullishOr(matchRedirect(loaded.manifest, path)),
      manifestRedirect
    )
  );
