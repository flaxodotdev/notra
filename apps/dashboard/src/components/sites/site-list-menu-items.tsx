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
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@notra/ui/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import type { SiteListMenuItemsProps } from "@/types/components/sites";
import { copyTextToClipboard } from "@/utils/copy-to-clipboard";
import { siteHref } from "@/utils/site-links";

export function SiteListMenuItems({
  organizationSlug,
  site,
  onDelete,
  variant,
}: SiteListMenuItemsProps) {
  const t = useTranslations("sites.list.actions");
  const tTabs = useTranslations("sites.detail.tabs");
  const tCommon = useTranslations("common");
  const tDelete = useTranslations("sites.settings.delete");
  const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
  const Separator =
    variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
  return (
    <>
      <Item render={<Link href={siteHref(organizationSlug, site.id)} />}>
        <HugeiconsIcon
          aria-hidden="true"
          icon={DashboardSquare01Icon}
          strokeWidth={1.5}
        />
        {t("openSite")}
      </Item>
      <Item
        render={
          <a
            aria-label={t("visitSite")}
            href={site.liveUrl}
            rel="noopener noreferrer"
            target="_blank"
          />
        }
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={LinkSquare02Icon}
          strokeWidth={1.5}
        />
        {t("visitSite")}
      </Item>
      <Item
        onClick={() =>
          copyTextToClipboard(site.liveUrl, tCommon("toasts.copied"))
        }
      >
        <HugeiconsIcon aria-hidden="true" icon={Copy01Icon} strokeWidth={1.5} />
        {t("copyLink")}
      </Item>
      <Separator />
      <Item
        render={<Link href={siteHref(organizationSlug, site.id, "editor")} />}
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={FileEditIcon}
          strokeWidth={1.5}
        />
        {tTabs("editor")}
      </Item>
      <Item
        render={
          <Link href={siteHref(organizationSlug, site.id, "deployments")} />
        }
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Rocket01Icon}
          strokeWidth={1.5}
        />
        {tTabs("deployments")}
      </Item>
      <Item
        render={<Link href={siteHref(organizationSlug, site.id, "settings")} />}
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Settings01Icon}
          strokeWidth={1.5}
        />
        {tTabs("settings")}
      </Item>
      <Separator />
      <Item onClick={onDelete} variant="destructive">
        <HugeiconsIcon
          aria-hidden="true"
          icon={Delete02Icon}
          strokeWidth={1.5}
        />
        {tDelete("action")}
      </Item>
    </>
  );
}
