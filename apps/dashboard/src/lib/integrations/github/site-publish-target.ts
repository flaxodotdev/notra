import {
  createOctokit,
  GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
} from "@notra/ai/utils/octokit";
import { db } from "@notra/db/drizzle";
import { sites, users } from "@notra/db/schema";
import { and, asc, eq, or, sql } from "drizzle-orm";

import { GITHUB_API_VERSION_HEADERS } from "@/constants/github";
import { SITE_ENTRY_DIRECTORIES } from "@/constants/site-github-publish";
import type {
  SiteGitHubPublishTarget,
  FindSiteGitHubPublishTargetParams,
  ReadSiteRepositoryTextFileParams,
  ResolveSiteEntryContextParams,
  SiteEntryContext,
} from "@/types/integrations/site-github-publish";
import { hasGitHubStatus } from "@/utils/github-publish-failure";
import {
  normalizeSiteRootDirectory,
  parseSiteConfigAuthors,
  readSiteEntryAuthor,
  resolveSiteAuthor,
  resolveSiteConfigPath,
} from "@/utils/site-github-publish";

export async function findSiteGitHubPublishTarget(
  params: FindSiteGitHubPublishTargetParams
): Promise<SiteGitHubPublishTarget | null> {
  const { repository } = params;
  const candidates = await db
    .select({
      id: sites.id,
      rootDirectory: sites.rootDirectory,
      productionBranch: sites.productionBranch,
      mounts: sites.mounts,
    })
    .from(sites)
    .where(
      and(
        eq(sites.organizationId, params.organizationId),
        or(
          eq(sites.repositoryId, repository.id),
          repository.githubRepositoryId
            ? eq(sites.githubRepositoryId, repository.githubRepositoryId)
            : undefined,
          and(
            sql`lower(${sites.repositoryOwner}) = ${repository.owner.toLowerCase()}`,
            sql`lower(${sites.repositoryName}) = ${repository.repo.toLowerCase()}`
          )
        )
      )
    )
    .orderBy(asc(sites.createdAt));
  if (candidates.length === 0) {
    return null;
  }

  const section = SITE_ENTRY_DIRECTORIES[params.contentType];
  const site =
    candidates.find((candidate) => Boolean(candidate.mounts[section])) ??
    candidates[0];
  if (!site) {
    return null;
  }
  return {
    siteId: site.id,
    rootDirectory: normalizeSiteRootDirectory(site.rootDirectory),
    productionBranch: site.productionBranch,
    sectionMounted: Boolean(site.mounts[section]),
  };
}

/**
 * Reads a text file, null when it does not exist. With `strict`, any other
 * failure throws: callers that merge into the file must not mistake a GitHub
 * hiccup for "no file" and drop what it contains.
 */
async function readRepositoryTextFile(
  token: string,
  params: ReadSiteRepositoryTextFileParams,
  options: { strict?: boolean } = {}
): Promise<string | null> {
  try {
    const { data } = await createOctokit(token, {
      requestTimeoutMs: GITHUB_INTERACTIVE_READ_TIMEOUT_MS,
    }).request("GET /repos/{owner}/{repo}/contents/{path}", {
      ...params,
      headers: GITHUB_API_VERSION_HEADERS,
    });
    if (
      Array.isArray(data) ||
      data.type !== "file" ||
      typeof data.content !== "string"
    ) {
      return null;
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch (error) {
    if (options.strict && !hasGitHubStatus(error, 404)) {
      throw error;
    }
    return null;
  }
}

async function readPublisherName(userId: string | undefined) {
  if (!userId) {
    return null;
  }
  const user = await db.query.users.findFirst({
    columns: { name: true },
    where: eq(users.id, userId),
  });
  return user?.name ?? null;
}

/**
 * Reads what the repository already has for this entry: the open pull
 * request's version if there is one, otherwise the live file. Also resolves
 * the legacy author fallback (the publisher, matched against notra.json).
 */
export async function resolveSiteEntryContext(
  params: ResolveSiteEntryContextParams
): Promise<SiteEntryContext> {
  const productionPath = params.existingEntry?.path ?? params.path;
  const [branchMarkdown, liveMarkdown, publisherName, siteConfig] =
    await Promise.all([
      params.existingEntry
        ? readRepositoryTextFile(
            params.token,
            {
              owner: params.owner,
              repo: params.repo,
              path: params.existingEntry.path,
              ref: params.existingEntry.branchName,
            },
            { strict: true }
          )
        : null,
      readRepositoryTextFile(
        params.token,
        {
          owner: params.owner,
          repo: params.repo,
          path: productionPath,
          ref: params.target.productionBranch,
        },
        { strict: true }
      ),
      params.contentType === "blog_post"
        ? readPublisherName(params.publisherUserId)
        : null,
      params.contentType === "blog_post"
        ? readRepositoryTextFile(params.token, {
            owner: params.owner,
            repo: params.repo,
            path: resolveSiteConfigPath(params.target.rootDirectory),
            ref: params.target.productionBranch,
          })
        : null,
    ]);
  const existingMarkdown = branchMarkdown ?? liveMarkdown;
  const existingAuthor = existingMarkdown
    ? readSiteEntryAuthor(existingMarkdown)
    : null;
  return {
    existingMarkdown,
    isLive: liveMarkdown !== null,
    author:
      params.contentType === "blog_post"
        ? (existingAuthor ??
          resolveSiteAuthor(
            siteConfig ? parseSiteConfigAuthors(siteConfig) : {},
            publisherName
          ))
        : null,
  };
}
