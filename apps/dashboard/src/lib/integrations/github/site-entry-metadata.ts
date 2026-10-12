import { postCoverImageSchema } from "@notra/ai/schemas/post-metadata";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { contentAuthors } from "@notra/db/schema";
import { contentAuthorsInOrganization } from "@notra/db/utils/post-metadata";

import { MARKDOWN_IMAGE_DESTINATION } from "@/constants/site-github-publish";
import { prepareR2GitHubContentAssets } from "@/lib/integrations/github/content-assets";
import type { PostMetadataColumns } from "@/types/content/overview";
import type {
  GitHubContentAsset,
  GitHubPublishContentType,
} from "@/types/integrations/github";
import type {
  SiteEntryAuthor,
  SiteEntryMediaContext,
  SiteEntryMetadata,
} from "@/types/integrations/site-github-publish";

/**
 * Copies one image into the pull request the same way inline images are
 * copied, and returns the path the site serves it from. Images hosted
 * elsewhere keep their absolute URL; Notra upload URLs that cannot be copied
 * (another organization's, or missing) are dropped instead of leaking a
 * dashboard-only path onto the site.
 */
async function prepareEntryImage(
  url: string,
  name: string,
  context: SiteEntryMediaContext
): Promise<{ src: string | null; assets: GitHubContentAsset[] }> {
  let prepared: Awaited<ReturnType<typeof prepareR2GitHubContentAssets>>;
  try {
    prepared = await prepareR2GitHubContentAssets({
      contentPath: context.contentPath,
      imagePathTemplate: `${context.imagePathTemplate}-${name}`,
      markdown: `![](${url})`,
      organizationId: context.organizationId,
      publicDirectory: context.publicDirectory,
      slug: context.slug,
    });
  } catch (error) {
    // A deleted or oversized upload costs the post its cover or an avatar,
    // never the whole publish.
    logError("Skipped a site entry image that could not be copied", error, {
      name,
      organizationId: context.organizationId,
    });
    return { src: null, assets: [] };
  }
  const src = MARKDOWN_IMAGE_DESTINATION.exec(prepared.markdown.trim())?.[1];
  // Only root paths and https URLs work in frontmatter: a relative path (a
  // custom image folder outside public/) would resolve against the post URL.
  const servable =
    src !== undefined &&
    !src.startsWith("/api/") &&
    (src.startsWith("https://") || src.startsWith("/"));
  if (!servable) {
    return { src: null, assets: [] };
  }
  return { src, assets: prepared.assets };
}

async function loadAuthors(organizationId: string, authorIds: string[]) {
  if (authorIds.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(contentAuthors)
    .where(contentAuthorsInOrganization(organizationId, authorIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Keep the order chosen in Notra.
  return authorIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/** Resolves a post's Notra metadata into frontmatter values plus the files to commit. */
export async function prepareSiteEntryMetadata(
  post: PostMetadataColumns,
  context: SiteEntryMediaContext & { contentType: GitHubPublishContentType }
): Promise<{ metadata: SiteEntryMetadata; assets: GitHubContentAsset[] }> {
  const assets: GitHubContentAsset[] = [];
  const cover = postCoverImageSchema.safeParse(post.coverImage);
  let image: SiteEntryMetadata["image"] = null;
  if (cover.success) {
    const prepared = await prepareEntryImage(cover.data.url, "cover", context);
    if (prepared.src) {
      image = { src: prepared.src, alt: cover.data.alt };
      assets.push(...prepared.assets);
    }
  }

  const authors: SiteEntryAuthor[] = [];
  // Only blog posts credit authors; changelogs would commit unused avatars.
  const authorIds = context.contentType === "blog_post" ? post.authorIds : [];
  for (const row of await loadAuthors(context.organizationId, authorIds)) {
    let avatar: string | null = null;
    if (row.avatarUrl) {
      const prepared = await prepareEntryImage(
        row.avatarUrl,
        `author-${row.slug}`,
        context
      );
      avatar = prepared.src;
      assets.push(...prepared.assets);
    }
    authors.push({
      id: row.slug,
      name: row.name,
      title: row.title,
      bio: row.bio,
      avatar,
      url: row.url,
      x: row.x,
      linkedin: row.linkedin,
      github: row.github,
    });
  }

  const uniqueAssets = [
    ...new Map(assets.map((asset) => [asset.path, asset])).values(),
  ];
  return {
    assets: uniqueAssets,
    metadata: {
      description: post.excerpt,
      image,
      tags: post.tags,
      authors,
      featured: post.featured,
      noindex: post.noindex,
      date: post.displayDate,
    },
  };
}
