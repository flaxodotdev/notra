"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POST_EXCERPT_MAX_LENGTH } from "@notra/ai/constants/post-metadata";
import { POST_EXCERPT_RECOMMENDED_LENGTH } from "@notra/schemas/constants/dashboard/post-metadata";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { cn } from "@notra/ui/lib/utils";
import { slugify } from "@notra/utils/slugify";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentDetailSourceMetadata } from "@/components/content/content-detail-source-metadata";
import { ContentAuthorsDialog } from "@/components/content/overview/content-authors-dialog";
import { ContentStatusBadge } from "@/components/content/overview/content-status-badge";
import { OverviewAuthorSelect } from "@/components/content/overview/overview-author-select";
import { OverviewCoverField } from "@/components/content/overview/overview-cover-field";
import { OverviewDateField } from "@/components/content/overview/overview-date-field";
import {
  OverviewField,
  OverviewToggleRow,
} from "@/components/content/overview/overview-field";
import { OverviewTagsInput } from "@/components/content/overview/overview-tags-input";
import { RecommendationsSection } from "@/components/content/recommendations-section";
import { SITE_ENTRY_DIRECTORIES } from "@/constants/site-github-publish";
import { useContentMetadata } from "@/lib/hooks/use-content-metadata";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ContentOverviewProps,
  OverviewDisclosureProps,
  UpdatePullRequestHintProps,
} from "@/types/content/overview";
import type { ContentApiResponse } from "@/types/hooks/content";
import { parseSourceMetadata } from "@/utils/content-detail";
import { toErrorMessage } from "@/utils/error-message";
import { extractMarkdownExcerpt } from "@/utils/site-github-publish";

function OverviewDisclosure({ label, children }: OverviewDisclosureProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm transition-colors [&[data-panel-open]>svg]:rotate-0">
        <HugeiconsIcon
          className="-rotate-90 transition-transform"
          icon={ArrowDown01Icon}
          size={14}
        />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function UpdatePullRequestHint({
  organizationId,
  contentId,
  content,
  flushPending,
}: UpdatePullRequestHintProps) {
  const t = useTranslations("content.overview.updatePr");
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const githubPublish = content.githubPublish;
  if (
    !githubPublish ||
    (content.contentType !== "blog_post" && content.contentType !== "changelog")
  ) {
    return null;
  }
  const contentType = content.contentType;
  const updatePullRequest = async () => {
    setPending(true);
    try {
      // A description typed a moment ago is still debounced: save it first.
      await flushPending();
      const result = await dashboardOrpc.content.publishChangelogToGitHub.call({
        organizationId,
        contentId,
        contentType,
        repositoryId: githubPublish.repositoryId,
        linkedOnly: true,
      });
      queryClient.setQueryData<ContentApiResponse>(
        dashboardOrpc.content.get.queryKey({
          input: { organizationId, contentId },
        }),
        (current) =>
          current
            ? {
                ...current,
                content: {
                  ...current.content,
                  githubPublish: {
                    ...githubPublish,
                    branchName: result.branchName,
                    path: result.path,
                    pullRequestNumber: result.pullRequestNumber,
                    pullRequestUrl: result.pullRequestUrl,
                  },
                },
              }
            : current
      );
      toast.success(t("done"));
    } catch (error) {
      toast.error(toErrorMessage(error, t("failed")));
    }
    setPending(false);
  };
  return (
    <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
      <Button
        className="shrink-0"
        loading={pending}
        onClick={() => {
          void updatePullRequest();
        }}
        size="xs"
        variant="secondary"
      >
        {t("action")}
      </Button>
    </div>
  );
}

export function ContentOverview(props: ContentOverviewProps) {
  const { organizationId, contentId, content } = props;
  const t = useTranslations("content.overview");
  const ids = { description: useId(), date: useId() };
  const [authorsOpen, setAuthorsOpen] = useState(false);
  const api = useContentMetadata({ organizationId, contentId, content });
  const { metadata } = api;
  const isBlog = content.contentType === "blog_post";
  const markdown = content.markdown ?? "";
  const autoExcerpt = useMemo(
    () => extractMarkdownExcerpt(markdown),
    [markdown]
  );
  const section = SITE_ENTRY_DIRECTORIES[isBlog ? "blog_post" : "changelog"];
  const slug = content.slug || slugify(content.title);
  const hasSource = parseSourceMetadata(content.sourceMetadata) !== null;
  const hasRecommendations = Boolean(content.recommendations?.trim());
  const descriptionLength = metadata.excerpt?.length ?? 0;

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-1">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-foreground text-[13px] font-medium">
            {t("status.label")}
          </span>
          <ContentStatusBadge status={content.status} />
        </div>
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="text-foreground text-[13px] font-medium">
            {t("url")}
          </span>
          <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
            /{section}/{slug}
          </span>
        </div>
        {isBlog ? (
          <OverviewToggleRow
            checked={metadata.featured}
            hint={t("featured.hint")}
            label={t("featured.label")}
            onCheckedChange={(featured) => api.update({ featured })}
          />
        ) : null}
        {isBlog ? (
          <OverviewToggleRow
            checked={!metadata.noindex}
            hint={t("indexed.hint")}
            label={t("indexed.label")}
            onCheckedChange={(visible) => api.update({ noindex: !visible })}
          />
        ) : null}
      </div>

      <div className="bg-border h-px" />

      <OverviewField hint={t("cover.hint")} label={t("cover.label")}>
        <OverviewCoverField api={api} markdown={markdown} />
      </OverviewField>

      <OverviewField
        hint={t("description.hint")}
        htmlFor={ids.description}
        label={t("description.label")}
      >
        <Textarea
          className="min-h-20 resize-none"
          id={ids.description}
          maxLength={POST_EXCERPT_MAX_LENGTH}
          onChange={(event) =>
            api.updateDebounced({ excerpt: event.target.value })
          }
          placeholder={autoExcerpt}
          value={metadata.excerpt ?? ""}
        />
        <p
          className={cn(
            "text-muted-foreground text-xs tabular-nums",
            descriptionLength > POST_EXCERPT_RECOMMENDED_LENGTH &&
              "text-amber-600 dark:text-amber-400"
          )}
        >
          {descriptionLength > 0
            ? t("description.count", {
                count: descriptionLength,
                max: POST_EXCERPT_RECOMMENDED_LENGTH,
              })
            : t("description.auto")}
        </p>
      </OverviewField>

      {isBlog ? (
        <OverviewField
          aside={
            <Button
              className="-my-1"
              onClick={() => setAuthorsOpen(true)}
              size="xs"
              variant="ghost"
            >
              {t("authors.manage")}
            </Button>
          }
          hint={t("authors.hint")}
          label={t("authors.label")}
        >
          <OverviewAuthorSelect
            authorIds={metadata.authorIds}
            onChange={(authorIds) => api.update({ authorIds })}
            organizationId={organizationId}
          />
          <ContentAuthorsDialog
            onOpenChange={setAuthorsOpen}
            open={authorsOpen}
            organizationId={organizationId}
          />
        </OverviewField>
      ) : null}

      <OverviewField hint={t("tags.hint")} label={t("tags.label")}>
        <OverviewTagsInput
          onChange={(tags) => api.update({ tags })}
          organizationId={organizationId}
          tags={metadata.tags}
        />
      </OverviewField>

      <OverviewField
        hint={t("date.hint")}
        htmlFor={ids.date}
        label={t("date.label")}
      >
        <OverviewDateField
          fallback={content.date.slice(0, 10)}
          id={ids.date}
          onChange={(displayDate) => api.update({ displayDate })}
          value={metadata.displayDate}
        />
      </OverviewField>

      <UpdatePullRequestHint {...props} flushPending={api.flushPending} />

      {hasSource || hasRecommendations ? (
        <>
          <div className="bg-border h-px" />
          <div className="space-y-3">
            {hasSource ? (
              <OverviewDisclosure label={t("source.label")}>
                <ContentDetailSourceMetadata
                  organizationId={organizationId}
                  sourceMetadata={content.sourceMetadata}
                />
              </OverviewDisclosure>
            ) : null}
            <RecommendationsSection value={content.recommendations} />
          </div>
        </>
      ) : null}
    </div>
  );
}
