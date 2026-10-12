"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import { CONTENT_STATUS_BADGES } from "@/constants/content-overview";
import type { ContentStatusBadgeProps } from "@/types/content/overview";

/** Post status in the same badge style as site deployments. */
export function ContentStatusBadge({ status }: ContentStatusBadgeProps) {
  const t = useTranslations("content.overview.status");
  const appearance = CONTENT_STATUS_BADGES[status];
  return (
    <Badge shape="rounded" size="md" variant={appearance.variant}>
      {"icon" in appearance ? (
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
      {t(status)}
    </Badge>
  );
}
