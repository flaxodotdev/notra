"use client";

import { useTranslations } from "use-intl";

import { StatusBadge } from "@/components/status-badge";
import { API_KEY_STATUS_BADGES } from "@/constants/api-keys";
import type { ApiKeyStatusBadgeProps } from "@/types/api-keys";

export function ApiKeyStatusBadge({ status }: ApiKeyStatusBadgeProps) {
  const t = useTranslations("apiKeys.status");
  return (
    <StatusBadge appearance={API_KEY_STATUS_BADGES[status]} label={t(status)} />
  );
}
