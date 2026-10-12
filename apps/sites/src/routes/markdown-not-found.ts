import { joinMountPath } from "@notra/sites-core/utils/mounts";
import { Effect, Option } from "effect";

import { PREVIEW_CACHE_CONTROL } from "../constants/responses";
import { serveFile } from "../responses";
import { markdownNotFound } from "../responses/markdown-not-found";
import type { ManifestRouteContext } from "../types/routes";

export const markdownNotFoundRoute = Effect.fn("Sites.route.markdownNotFound")(
  function* ({
    path,
    area,
    wantsMarkdown,
    markdownNotFoundPath,
    resolved,
    loaded,
    fileParams,
  }: ManifestRouteContext) {
    if (!(wantsMarkdown || path.endsWith(".md"))) {
      return Option.none<Response>();
    }
    const notFound = area ? loaded.files.get(markdownNotFoundPath) : undefined;
    if (!notFound) {
      return Option.some(
        markdownNotFound({
          path,
          indexPath: area ? joinMountPath(area.mount, "index.md") : null,
          llmsPath: joinMountPath(area?.mount ?? "/", "llms.txt"),
          llmsLink: fileParams.llmsLink,
        })
      );
    }
    const response = yield* Effect.promise(() =>
      serveFile({
        ...fileParams,
        file: notFound,
        status: 404,
        extraHeaders: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": resolved.isPreview
            ? PREVIEW_CACHE_CONTROL
            : "no-store",
          "X-Robots-Tag": "noindex",
          Vary: "Accept",
        },
      })
    );
    return Option.some(response);
  }
);
