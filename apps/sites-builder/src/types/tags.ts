import type { BlogEntry, ChangelogEntry } from "./entries";

export interface TagLink {
  name: string;
  slug: string;
  href: string;
}

export interface SiteTag<
  Entry extends BlogEntry | ChangelogEntry,
> extends TagLink {
  entries: Entry[];
}

export interface TagListProps {
  tags: TagLink[];
  class?: string;
  /** Lifts the links above a card's full-size link overlay. */
  overlay?: boolean;
}

export type AreaTag = SiteTag<BlogEntry | ChangelogEntry>;

export type TagPageProps =
  | { kind: "index"; tags: AreaTag[] }
  | { kind: "tag"; tag: AreaTag };
