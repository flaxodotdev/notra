export const WORDS_PER_MINUTE = 220;

/** Mirrors SITE_AUTHOR_ID / SITE_AUTHOR_AVATAR in @notra/sites-core, which the theme can't value-import. */
export const AUTHOR_ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const AUTHOR_AVATAR = /^(?:\/(?!\/)|https:\/\/)/;
export const HTTP_PROTOCOL = /^https?$/;

/** Frontmatter `featured: true` pins at most this many posts, like `blog.featured`. */
export const FRONTMATTER_FEATURED_LIMIT = 6;

export const EDGE_SLASHES = /^\/+|\/+$/g;

export const AUTHOR_FIELDS = [
  "title",
  "bio",
  "avatar",
  "url",
  "x",
  "linkedin",
  "github",
] as const;
