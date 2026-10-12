"use client";

import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@notra/ui/components/ui/popover";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { Calendar } from "@/components/calendar";
import type { OverviewDateFieldProps } from "@/types/content/overview";
import {
  displayDateToLocalDate,
  localDateToDisplayDate,
} from "@/utils/content-metadata";

/** The shared calendar in a popover, like the shelf's due date field. */
export function OverviewDateField({
  id,
  value,
  fallback,
  onChange,
}: OverviewDateFieldProps) {
  const t = useTranslations("content.overview.date");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const day = value ?? fallback;
  const shown = displayDateToLocalDate(day);
  // A calendar day, so format it in UTC: server and browser agree on it.
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    [locale]
  );
  const label = formatter.format(new Date(`${day}T00:00:00.000Z`));

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-start gap-2 font-normal"
            id={id}
            variant="outline"
          />
        }
      >
        <HugeiconsIcon
          className="text-muted-foreground size-4"
          icon={Calendar03Icon}
        />
        <span className="truncate">{label}</span>
        {value ? null : (
          <span className="text-muted-foreground ms-auto shrink-0 text-xs">
            {t("auto")}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto overflow-hidden p-0"
        initialFocus={false}
      >
        <Calendar
          defaultMonth={shown}
          mode="single"
          onSelect={(date) => {
            if (date) {
              onChange(localDateToDisplayDate(date));
              setOpen(false);
            }
          }}
          selected={shown}
        />
        {value ? (
          <div className="flex justify-end border-t p-2">
            <Button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              size="sm"
              variant="ghost"
            >
              {t("reset")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
