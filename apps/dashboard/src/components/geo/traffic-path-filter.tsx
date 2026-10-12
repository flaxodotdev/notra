"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import {
  FilterHorizontalIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_FILTER_TRIGGER_CLASS } from "@notra/geo-core/constants/geo";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";
import { useTranslations } from "use-intl";

import { TRAFFIC_PATH_ALL } from "@/constants/traffic-path";
import { useTrafficPathQuery } from "@/lib/hooks/use-traffic-path";
import type { TrafficPathFilterProps } from "@/types/geo";

export function TrafficPathFilter({ paths }: TrafficPathFilterProps) {
  const t = useTranslations("geo.trafficPathFilter");
  const [path, setPath] = useTrafficPathQuery();
  const options = [
    TRAFFIC_PATH_ALL,
    ...(path && !paths.includes(path) ? [path] : []),
    ...paths,
  ];
  const label = (value: string) =>
    value === TRAFFIC_PATH_ALL ? t("allPages") : value;

  return (
    <Combobox
      itemToStringLabel={label}
      items={options}
      onValueChange={(next) => {
        void setPath(!next || next === TRAFFIC_PATH_ALL ? "" : next);
      }}
      value={path || TRAFFIC_PATH_ALL}
    >
      <ComboboxPrimitive.Trigger
        aria-label={t("label")}
        className={`${GEO_FILTER_TRIGGER_CLASS} max-w-56`}
      >
        <HugeiconsIcon
          className="text-muted-foreground shrink-0"
          icon={FilterHorizontalIcon}
          size={12}
        />
        <span className="truncate">{path || t("label")}</span>
        <HugeiconsIcon
          className="text-muted-foreground shrink-0"
          icon={UnfoldMoreIcon}
          size={12}
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent align="end" className="w-72">
        <ComboboxInput placeholder={t("search")} showTrigger={false} />
        <ComboboxEmpty>{t("noMatches")}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="truncate">{label(item)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
