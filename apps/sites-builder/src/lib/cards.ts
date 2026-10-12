import type { BlogEntry, CardImages } from "../types/entries";
import { blogOptions } from "./options";

/**
 * How a listing shows covers. `true` frames every card and fills missing
 * covers with a placeholder; `"auto"` shows covers only when the listing has
 * at least one, and cards without a cover stay unframed.
 */
export function cardImages(entries: BlogEntry[]): CardImages {
  const setting = blogOptions.card.image;
  const anyImage = entries.some((entry) => Boolean(entry.data.image));
  if (setting === "auto") {
    return { show: anyImage, placeholder: false };
  }
  return { show: setting, placeholder: setting };
}
