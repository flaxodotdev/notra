"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import { SITE_STATUS_BADGES } from "@/constants/sites";
import { cn } from "@/lib/utils";
import type { SiteStatusBadgeProps } from "@/types/components/sites";

export function SiteStatusBadge({
  status,
  duration,
  className,
}: SiteStatusBadgeProps) {
  const t = useTranslations("sites.status");
  const label = t(status === "uploading" ? "building" : status);
  const appearance = SITE_STATUS_BADGES[status];
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 text-sm",
        className
      )}
    >
      <Badge shape="rounded" size="md" variant={appearance.variant}>
        {appearance.icon && appearance.square ? (
          <span
            aria-hidden="true"
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-xs bg-current"
          >
            <HugeiconsIcon
              className="text-background size-3"
              icon={appearance.icon}
              strokeWidth={2}
            />
          </span>
        ) : null}
        {appearance.icon && !appearance.square ? (
          <HugeiconsIcon
            aria-hidden="true"
            icon={appearance.icon}
            strokeWidth={1.5}
          />
        ) : null}
        {label}
      </Badge>
      {duration ? (
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {duration}
        </span>
      ) : null}
    </span>
  );
}

export function SiteOfflineStatus() {
  const t = useTranslations("sites.status");
  return (
    <Badge shape="rounded" size="md" variant="secondary">
      {t("offline")}
    </Badge>
  );
}
