"use client";

import { CloudOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { ORPCError } from "@orpc/client";
import { useEffect } from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useSiteDetail, useSitesOrganizationId } from "@/lib/hooks/use-sites";
import type {
  SiteLayoutProps,
  SiteLoadErrorProps,
} from "@/types/components/sites";
import { siteHref } from "@/utils/site-links";

import { SiteContext } from "./site-context";
import { SitePageSkeleton } from "./site-page-skeleton";
import { SitesPageShell } from "./sites-page-shell";
import { SitesUnavailableState } from "./sites-unavailable-state";

export function SiteLayout({
  organizationSlug,
  siteId,
  children,
}: SiteLayoutProps) {
  const t = useTranslations("sites.detail");
  const organizationId = useSitesOrganizationId(organizationSlug);
  const detailQuery = useSiteDetail(organizationId, siteId);
  const [projectParam, setProjectParam] = useGeoProjectQueryState();
  const owningProjectId = detailQuery.data?.site.projectId;

  useEffect(() => {
    if (owningProjectId && projectParam !== owningProjectId) {
      setProjectParam(owningProjectId);
    }
  }, [owningProjectId, projectParam, setProjectParam]);

  if (!detailQuery.data && detailQuery.error) {
    return (
      <SiteLoadError
        error={detailQuery.error}
        organizationSlug={organizationSlug}
      />
    );
  }

  if (!detailQuery.data || projectParam !== owningProjectId) {
    return <SitePageSkeleton />;
  }
  const detail = detailQuery.data;
  const liveDeployment =
    detail.deployments.find(
      (deployment) => deployment.id === detail.site.liveDeploymentId
    ) ?? null;

  return (
    <SiteContext
      value={{
        organizationId,
        organizationSlug,
        siteId,
        detail,
        liveDeployment,
      }}
    >
      <SitesPageShell>
        {detail.site.status === "suspended" ? (
          <Alert role="status">
            <HugeiconsIcon
              aria-hidden="true"
              icon={CloudOffIcon}
              strokeWidth={1.5}
            />
            <AlertTitle>{t("offline")}</AlertTitle>
            <AlertDescription>
              {t("offlineDescription")}{" "}
              <Link href={siteHref(organizationSlug, siteId, "settings")}>
                {t("offlineAction")}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        {children}
      </SitesPageShell>
    </SiteContext>
  );
}

function SiteLoadError({ error, organizationSlug }: SiteLoadErrorProps) {
  const t = useTranslations("sites.detail");
  if (error instanceof ORPCError && error.code === "SERVICE_UNAVAILABLE") {
    return (
      <SitesPageShell>
        <SitesUnavailableState />
      </SitesPageShell>
    );
  }
  const state =
    error instanceof ORPCError && error.code === "NOT_FOUND"
      ? "notFound"
      : "loadFailed";
  return (
    <SitesPageShell>
      <EmptyState
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/${organizationSlug}/sites?view=all`}
          >
            {t("backToSites")}
          </Link>
        }
        description={t(`${state}.description`)}
        title={t(`${state}.title`)}
      />
    </SitesPageShell>
  );
}
