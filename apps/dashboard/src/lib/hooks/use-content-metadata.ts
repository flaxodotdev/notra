"use client";

import type { ContentResponse } from "@notra/schemas/dashboard/content";
import type { PostMetadataPatch } from "@notra/schemas/shared/post-metadata";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { CONTENT_METADATA_DEBOUNCE_MS } from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ContentMetadataApi,
  ContentMetadataTarget,
  PendingMetadataPatch,
  UseContentMetadataParams,
} from "@/types/content/overview";
import type { ContentApiResponse } from "@/types/hooks/content";
import { applyMetadataPatch } from "@/utils/content-metadata";
import { toErrorMessage } from "@/utils/error-message";

export function useContentMetadata(
  params: UseContentMetadataParams
): ContentMetadataApi {
  const { organizationId, contentId } = params;
  const t = useTranslations("content.overview");
  const queryClient = useQueryClient();

  const setMetadataFor = useCallback(
    (
      target: ContentMetadataTarget,
      update: (
        metadata: ContentResponse["metadata"]
      ) => ContentResponse["metadata"]
    ) => {
      queryClient.setQueryData<ContentApiResponse>(
        dashboardOrpc.content.get.queryKey({ input: target }),
        (current) =>
          current
            ? {
                ...current,
                content: {
                  ...current.content,
                  metadata: update(current.content.metadata),
                },
              }
            : current
      );
    },
    [queryClient]
  );

  const pending = useRef<PendingMetadataPatch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequest = useRef(0);
  // Writes go out one after another, so the last edit is also the last write.
  const queue = useRef<Promise<void> | null>(null);

  const write = useCallback(
    (target: ContentMetadataTarget, patch: PostMetadataPatch) => {
      const request = ++latestRequest.current;
      const run = async () => {
        try {
          const result = await dashboardOrpc.content.updateMetadata.call({
            ...target,
            metadata: patch,
          });
          // Optimistic edits made since stay on screen until their own write.
          if (request === latestRequest.current && pending.current === null) {
            setMetadataFor(target, () => result.content.metadata);
          }
        } catch (error) {
          toast.error(toErrorMessage(error, t("saveFailed")));
          void queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.get.queryKey({ input: target }),
          });
        }
      };
      queue.current = (queue.current ?? Promise.resolve()).then(run);
      return queue.current;
    },
    [queryClient, setMetadataFor, t]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    return next
      ? write(next.target, next.patch)
      : (queue.current ?? Promise.resolve());
  }, [write]);

  const update = useCallback(
    (patch: PostMetadataPatch) => {
      const target = { organizationId, contentId };
      setMetadataFor(target, (metadata) => applyMetadataPatch(metadata, patch));
      void flush();
      void write(target, patch);
    },
    [contentId, flush, organizationId, setMetadataFor, write]
  );

  const updateDebounced = useCallback(
    (patch: PostMetadataPatch) => {
      const target = { organizationId, contentId };
      setMetadataFor(target, (metadata) => applyMetadataPatch(metadata, patch));
      // An edit still waiting for another post goes out to that post first.
      if (pending.current && pending.current.target.contentId !== contentId) {
        void flush();
      }
      pending.current = {
        target,
        patch: { ...pending.current?.patch, ...patch },
      };
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        void flush();
      }, CONTENT_METADATA_DEBOUNCE_MS);
    },
    [contentId, flush, organizationId, setMetadataFor]
  );

  // Never drop a pending edit when the panel goes away or shows another post.
  const flushNow = useEffectEvent(() => {
    void flush();
  });
  useEffect(() => () => flushNow(), [organizationId, contentId]);

  return {
    metadata: params.content.metadata,
    update,
    updateDebounced,
    flushPending: flush,
  };
}
