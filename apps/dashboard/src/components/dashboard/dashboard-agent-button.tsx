"use client";

import { Robot01Icon, SidebarRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { useTranslations } from "use-intl";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import {
  setContentPanelDismissed,
  useContentPanelHasOverview,
} from "@/lib/content-panel-tab";
import { usePathname } from "@/lib/navigation";
import type { RightPanelId } from "@/types/components/right-panel";
import { isContentDetailPathname } from "@/utils/dashboard-paths";

export function DashboardAgentButton() {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  const tOverview = useTranslations("content.overview");
  const pathname = usePathname();
  const { active, togglePanel } = useRightPanel();
  const hasOverview = useContentPanelHasOverview();
  const panelId: RightPanelId = isContentDetailPathname(pathname)
    ? "content"
    : "agent";
  const open = active === panelId;
  // Blog posts and changelogs: the panel holds Overview and Agent tabs, so
  // the button shows and hides the whole panel instead of opening the agent.
  const isDetails = panelId === "content" && hasOverview;
  const label = isDetails
    ? tOverview("detailsButton")
    : tCommon("labels.agent");

  return (
    <Button
      aria-label={isDetails ? label : open ? t("closeLabel") : t("openLabel")}
      aria-pressed={open}
      className="hover:bg-background size-7 px-0 lg:w-auto lg:px-2.5"
      onClick={() => {
        if (isDetails) {
          setContentPanelDismissed(open);
        }
        togglePanel(panelId);
      }}
      size="sm"
      title={label}
      variant={open ? "secondary" : "ghost"}
    >
      <HugeiconsIcon
        icon={isDetails ? SidebarRightIcon : Robot01Icon}
        strokeWidth={1.8}
      />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  );
}
