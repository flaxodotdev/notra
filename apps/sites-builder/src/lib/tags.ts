import { TAG_ENTRY_NOUNS } from "../constants/tags";
import type { BlogEntry, ChangelogEntry } from "../types/entries";
import type { SiteTag, TagLink } from "../types/tags";
import { tagSlug } from "../utils/tags";
import { href, params } from "./params";

export function tagsHref(): string {
  return href("tags");
}

function tagLink(name: string, slug: string): TagLink {
  return { name, slug, href: href(`tags/${slug}`) };
}

/** The entry's tags with a page, deduplicated by slug in their written order. */
export function entryTags(entry: BlogEntry | ChangelogEntry): TagLink[] {
  const seen = new Set<string>();
  const links: TagLink[] = [];
  for (const name of entry.data.tags) {
    const slug = tagSlug(name);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      links.push(tagLink(name.trim(), slug));
    }
  }
  return links;
}

/**
 * Tags across the entries, most used first. Tags group case-insensitively and
 * keep the spelling of the newest entry that uses them.
 */
export function collectTags<Entry extends BlogEntry | ChangelogEntry>(
  entries: Entry[]
): SiteTag<Entry>[] {
  const tags = new Map<string, SiteTag<Entry>>();
  for (const entry of entries) {
    for (const link of entryTags(entry)) {
      const tag = tags.get(link.slug) ?? { ...link, entries: [] };
      tag.entries.push(entry);
      tags.set(link.slug, tag);
    }
  }
  return [...tags.values()].sort(
    (a, b) =>
      b.entries.length - a.entries.length || a.name.localeCompare(b.name)
  );
}

/** "1 post", "3 updates": the count in the current area's words. */
export function entryCount(count: number): string {
  const nouns = TAG_ENTRY_NOUNS[params.area];
  return `${count} ${count === 1 ? nouns.one : nouns.other}`;
}
