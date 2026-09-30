import { WHITESPACE_RE } from "../constants/dom-to-scene";
import {
  BLEND_MODE_MAP,
  CSS_LENGTH_RE,
  URL_REF_RE,
} from "../constants/svg-clip";
import type { CssFunction, ParsedDropShadow } from "../types/svg-clip";

export function parseUrlRef(value: string | null | undefined): string | null {
  return URL_REF_RE.exec(value ?? "")?.[1]?.trim() || null;
}

export function parseBlendMode(
  value: string | null | undefined
): string | undefined {
  return BLEND_MODE_MAP[(value ?? "").trim().toLowerCase()];
}

export function parseOpacityValue(
  value: string | null | undefined
): number | undefined {
  if (value == null) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const opacity = value.trim().endsWith("%") ? parsed / 100 : parsed;
  return Math.max(0, Math.min(1, opacity));
}

export function parseCssLength(token: string | undefined): number | null {
  const match = CSS_LENGTH_RE.exec(token?.trim() ?? "");
  return match?.[1] ? Number.parseFloat(match[1]) : null;
}

export function splitCssFunctions(value: string): CssFunction[] {
  const functions: CssFunction[] = [];
  let depth = 0;
  let start = 0;
  let name = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(") {
      if (depth === 0) {
        name = value.slice(start, i).trim();
        start = i + 1;
      }
      depth += 1;
    } else if (char === ")" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        functions.push({ name, args: value.slice(start, i) });
        start = i + 1;
      }
    }
  }
  return functions;
}

export function parseDropShadowArgs(args: string): ParsedDropShadow | null {
  const parts = args.trim().split(WHITESPACE_RE).filter(Boolean);
  for (let k = 0; k + 1 < parts.length; k += 1) {
    const dx = parseCssLength(parts[k]);
    const dy = parseCssLength(parts[k + 1]);
    if (dx === null || dy === null) {
      continue;
    }
    const rest = parts.slice(k + 2);
    const blur = parseCssLength(rest[0]);
    const leadingColor = parts.slice(0, k).join(" ") || null;
    const trailingColor = rest.slice(blur === null ? 0 : 1).join(" ") || null;
    if (leadingColor && trailingColor) {
      return null;
    }
    return {
      dx,
      dy,
      blur: Math.max(0, blur ?? 0),
      color: leadingColor ?? trailingColor,
    };
  }
  return null;
}
