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
    onSuccess: (_result, socialVideo) => {
      const queryKey = dashboardOrpc.content.get.queryKey({
        input: { organizationId, contentId },
      });
      // Reopening the dialog before the refetch lands must see the new video.
      queryClient.setQueryData<ContentApiResponse>(queryKey, (current) =>
        current
          ? {
              ...current,
              content: {
                ...current.content,
                sourceMetadata: {
                  ...current.content.sourceMetadata,
                  socialVideo,
                },
              },
            }
          : current
      );
      return queryClient.invalidateQueries({ queryKey });
    },
  });
}
