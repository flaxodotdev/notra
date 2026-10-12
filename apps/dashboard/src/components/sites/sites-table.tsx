"use client";

import {
  Copy01Icon,
  DashboardSquare01Icon,
  Delete02Icon,
  FileEditIcon,
  LinkSquare02Icon,
  Rocket01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";
import {
  DataTable,
  type TableColumn,
} from "@notra/ui/components/ui/data-table";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { RelativeTime } from "@/components/relative-time";
import { SiteDeleteDialog } from "@/components/sites/site-delete-dialog";
import {
  SiteOfflineStatus,
  SiteStatusDot,
} from "@/components/sites/site-status-dot";
import { SITE_OVERVIEW_ANALYTICS_DAYS } from "@/constants/sites";
import { useSiteAnalytics } from "@/lib/hooks/use-sites";
import { useRouter } from "@/lib/navigation";
import type { SitesTableProps } from "@/types/components/sites";
import type { SiteListItem } from "@/types/sites";
import { formatMetric } from "@/utils/analytics-charts";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { siteListStatus } from "@/utils/site-deployments";
import { displayUrl, siteHref } from "@/utils/site-links";
import { paginatedTableHeightFor } from "@/utils/table";

const SITES_TABLE_ROW_HEIGHT = 48;

function SiteVisitorsCell({
  organizationId,
  site,
}: {
  organizationId: string;
  site: SiteListItem;
}) {
  const locale = useLocale();
  const query = useSiteAnalytics(organizationId, site.id, {
    days: SITE_OVERVIEW_ANALYTICS_DAYS,
  });
  const totals = query.data?.web.totals;
  if (!totals) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium tabular-nums">
        {formatMetric(totals.visitors, locale, "-")}
      </span>
      <GeoStatDelta
        delta={trafficVisitDelta(totals.visitors, totals.previousVisitors)}
      />
    </span>
  );
}

export function SitesTable({
  organizationId,
  organizationSlug,
  sites,
}: SitesTableProps) {
  const t = useTranslations("sites.list");
  const tCommon = useTranslations("common");
  const tTabs = useTranslations("sites.detail.tabs");
  const tDelete = useTranslations("sites.settings.delete");
  const router = useRouter();
  const [deleteSite, setDeleteSite] = useState<SiteListItem | null>(null);

  const columns: TableColumn<SiteListItem>[] = [
    {
      key: "name",
      header: t("columns.site"),
      width: "1fr",
      minWidth: "14rem",
      sortable: true,
      cell: (site) => (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium">{site.name}</span>
          <a
            className="text-muted-foreground hover:text-foreground hidden min-w-0 truncate text-xs hover:underline sm:inline"
            href={site.liveUrl}
            onClick={(event) => event.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
          >
            {displayUrl(site.liveUrl)}
          </a>
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("labels.status"),
      width: "11rem",
      sortable: true,
      sortValue: (site) =>
        site.status === "suspended"
          ? "offline"
          : (siteListStatus(site)?.status ?? ""),
      cell: (site) => {
        if (site.status === "suspended") {
          return <SiteOfflineStatus />;
        }
        const state = siteListStatus(site);
        if (!state) {
          return (
            <span className="text-muted-foreground">{t("noDeployments")}</span>
          );
        }
        return <SiteStatusDot live={state.live} status={state.status} />;
      },
    },
    {
      key: "visitors",
      header: t("columns.visitors"),
      width: "10rem",
      align: "right",
      collapsePriority: 1,
      cell: (site) =>
        site.status === "suspended" || !site.analyticsEnabled ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <SiteVisitorsCell organizationId={organizationId} site={site} />
        ),
    },
    {
      key: "updated",
      header: t("columns.updated"),
      width: "9rem",
      align: "right",
      collapsePriority: 2,
      sortable: true,
      sortValue: (site) => {
        const state = siteListStatus(site);
        return state ? new Date(state.at).getTime() : 0;
      },
      cell: (site) => {
        const state = siteListStatus(site);
        return state ? (
          <RelativeTime iso={new Date(state.at).toISOString()} />
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={sites}
        getRowId={(site) => site.id}
        defaultSort={{ key: "updated", direction: "desc" }}
        height={paginatedTableHeightFor(sites.length, SITES_TABLE_ROW_HEIGHT)}
        onRowClick={(site) => router.push(siteHref(organizationSlug, site.id))}
        onRowPointerEnter={(site) =>
          router.prefetch(siteHref(organizationSlug, site.id))
        }
        renderRowContextMenu={(site) => (
          <>
            <ContextMenuItem
              onClick={() => router.push(siteHref(organizationSlug, site.id))}
            >
              <HugeiconsIcon
                icon={DashboardSquare01Icon}
                size={16}
                strokeWidth={1.5}
              />
              {t("actions.openSite")}
            </ContextMenuItem>
            <ContextMenuItem
              render={
                <a
                  aria-label={t("actions.visitSite")}
                  href={site.liveUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                />
              }
            >
              <HugeiconsIcon
                icon={LinkSquare02Icon}
                size={16}
                strokeWidth={1.5}
              />
              {t("actions.visitSite")}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                copyTextToClipboard(site.liveUrl, tCommon("toasts.copied"))
              }
            >
              <HugeiconsIcon icon={Copy01Icon} size={16} strokeWidth={1.5} />
              {t("actions.copyLink")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                router.push(siteHref(organizationSlug, site.id, "editor"))
              }
            >
              <HugeiconsIcon icon={FileEditIcon} size={16} strokeWidth={1.5} />
              {tTabs("editor")}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                router.push(siteHref(organizationSlug, site.id, "deployments"))
              }
            >
              <HugeiconsIcon icon={Rocket01Icon} size={16} strokeWidth={1.5} />
              {tTabs("deployments")}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                router.push(siteHref(organizationSlug, site.id, "settings"))
              }
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={16}
                strokeWidth={1.5}
              />
              {tTabs("settings")}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setDeleteSite(site)}
              variant="destructive"
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.5} />
              {tDelete("action")}
            </ContextMenuItem>
          </>
        )}
        resizable
        rowHeight={SITES_TABLE_ROW_HEIGHT}
        scrollFade={false}
      />
      {deleteSite ? (
        <SiteDeleteDialog
          key={deleteSite.id}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteSite(null);
            }
          }}
          open
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          siteId={deleteSite.id}
          siteName={deleteSite.name}
        />
      ) : null}
    </>
  );
}
