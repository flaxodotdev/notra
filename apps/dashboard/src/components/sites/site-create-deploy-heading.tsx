"use client";

import { HugeiconsIcon } from "@hugeicons/react";

import { SITE_CREATE_DEPLOY_TONE_ICONS } from "@/constants/site-create";
import { cn } from "@/lib/utils";
import type { SiteCreateDeployHeadingProps } from "@/types/components/sites";

export function SiteCreateDeployHeading({
  headline,
  tone,
}: SiteCreateDeployHeadingProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        tone === "success" && "text-success",
        tone === "error" && "text-destructive",
        tone === "pending" && "text-muted-foreground"
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          tone === "pending" && "motion-safe:animate-spin"
        )}
        icon={SITE_CREATE_DEPLOY_TONE_ICONS[tone]}
        strokeWidth={1.75}
      />
      {tone === "error" ? (
        <span className="text-foreground">{headline}</span>
      ) : (
        headline
      )}
      {/* Only settled states are announced; the ticking build timer is not. */}
      <span aria-live="polite" className="sr-only">
        {tone === "pending" ? "" : headline}
      </span>
    </span>
  );
}
