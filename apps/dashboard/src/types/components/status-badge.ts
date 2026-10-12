import type { IconSvgElement } from "@hugeicons/react";
import type { Badge } from "@notra/ui/components/ui/badge";
import type { ComponentProps } from "react";

export interface StatusBadgeAppearance {
  variant: NonNullable<ComponentProps<typeof Badge>["variant"]>;
  icon?: IconSvgElement;
  /** Draws the icon as a knocked-out glyph on a filled square. */
  square?: boolean;
}

export interface StatusBadgeProps {
  label: string;
  appearance: StatusBadgeAppearance;
}
