"use client";

import type { SocialVideoAttachment } from "@notra/schemas/dashboard/content";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ContentApiResponse } from "@/types/hooks/content";

import { dashboardOrpc } from "../orpc/query";

export function useContent(organizationId: string, contentId: string) {
  return useQuery<ContentApiResponse>(
    dashboardOrpc.content.get.queryOptions({
      input: { organizationId, contentId },
      enabled: !!organizationId && !!contentId,
    })
  );
}

/** Saves the video posted with an X/LinkedIn post, so the calendar sends it too. */
export function useSaveSocialVideo(organizationId: string, contentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (socialVideo: SocialVideoAttachment | null) =>
      dashboardOrpc.content.update.call({
        organizationId,
        contentId,
        socialVideo,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.content.get.queryKey({
          input: { organizationId, contentId },
        }),
      }),
  });
}
