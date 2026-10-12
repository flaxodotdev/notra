import { AUTHOR_FIELDS } from "../constants/entries";
import type {
  AuthorFields,
  EntryAuthorRef,
  ResolvedAuthor,
} from "../types/authors";
import type { BlogEntry, ChangelogEntry } from "../types/entries";
import { absoluteUrl, assetUrl, config, href } from "./params";

function configAuthor(id: string): AuthorFields | undefined {
  return Object.hasOwn(config.authors, id) ? config.authors[id] : undefined;
}

function authorHref(id: string): string {
  return href(`author/${id}`);
}

function resolved(id: string | null, author: AuthorFields): ResolvedAuthor {
  const links = [author.url, author.x, author.linkedin, author.github].filter(
    (link): link is string => Boolean(link)
  );
  return {
    id,
    name: author.name,
    title: author.title,
    bio: author.bio,
    avatar: assetUrl(author.avatar),
    href: id ? authorHref(id) : undefined,
    links,
    url: author.url ?? links[0],
  };
}

/** blog.json wins for every field it sets; the frontmatter fills the rest. */
function mergedFields(
  fallback: AuthorFields,
  preferred: AuthorFields | undefined
): AuthorFields {
  if (!preferred) {
    return fallback;
  }
  const merged: AuthorFields = { ...fallback, name: preferred.name };
  for (const field of AUTHOR_FIELDS) {
    merged[field] = preferred[field] ?? fallback[field];
  }
  return merged;
}

function resolveAuthor(value: EntryAuthorRef): ResolvedAuthor {
  if (typeof value === "string") {
    const known = configAuthor(value);
    return known
      ? resolved(value, known)
      : { id: null, name: value, links: [] };
  }
  const { id, ...fields } = value;
  if (!id) {
    return resolved(null, fields);
  }
  return resolved(id, mergedFields(fields, configAuthor(id)));
}

function authorRefs(entry: BlogEntry): EntryAuthorRef[] {
  const author = entry.data.author;
  if (!author) {
    return [];
  }
  return Array.isArray(author) ? author : [author];
}

export function authorsOf(entry: BlogEntry): ResolvedAuthor[] {
  return authorRefs(entry).map(resolveAuthor);
}

export function authorNamesOf(entry: BlogEntry | ChangelogEntry): string[] {
  return entry.collection === "blog"
    ? authorsOf(entry).map((author) => author.name)
    : [];
}

/**
 * Every author with a page: the blog.json authors plus authors that only
 * exist in frontmatter with an `id`. Entries come newest first, so the newest
 * post's details win, older posts fill the gaps and blog.json wins over both.
 */
export function allAuthors(entries: BlogEntry[]): ResolvedAuthor[] {
  const inline = new Map<string, AuthorFields>();
  for (const entry of entries) {
    for (const ref of authorRefs(entry)) {
      if (typeof ref === "string" || !ref.id) {
        continue;
      }
      const { id, ...fields } = ref;
      const newer = inline.get(id);
      inline.set(id, newer ? mergedFields(fields, newer) : fields);
    }
  }
  const known = Object.entries(config.authors).map(([id, author]) =>
    resolved(id, mergedFields(inline.get(id) ?? author, author))
  );
  const inlineOnly = [...inline]
    .filter(([id]) => !configAuthor(id))
    .map(([id, author]) => resolved(id, author));
  return [...known, ...inlineOnly];
}

export function authoredBy(entry: BlogEntry, id: string | null): boolean {
  return authorsOf(entry).some((byline) => byline.id === id);
}

export function personNode(author: ResolvedAuthor) {
  return {
    "@type": "Person",
    name: author.name,
    url: author.href ? absoluteUrl(author.href) : author.url,
    image: author.avatar ? absoluteUrl(author.avatar) : undefined,
    jobTitle: author.title,
    description: author.bio,
    sameAs: author.links.length > 0 ? author.links : undefined,
  };
}
