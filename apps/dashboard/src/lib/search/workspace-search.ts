import { db } from "@notra/db/drizzle";
import {
  brandReferences,
  brandSettings,
  chatSessions,
  connectedSocialAccounts,
  geoCompetitors,
  geoPersonas,
  geoPrompts,
  githubIntegrations,
  linearIntegrations,
  posts,
  sites,
} from "@notra/db/schema";
import { projectScopedCollectionIds } from "@notra/db/utils/projects";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { isSitesEnabledForOrganization } from "@/lib/sites/flag";
import type { WorkspaceSearchParams } from "@/types/search";

const LIKE_ESCAPE_PATTERN = /[\\%_]/g;

function toLikePattern(input: string): string {
  return `%${input.replace(LIKE_ESCAPE_PATTERN, (char) => `\\${char}`)}%`;
}

/**
 * Substring search over the workspace entities the command palette can open.
 * GEO entities are project scoped and only searched when `projectId` is set.
 * Callers check organization access first.
 */
export async function searchWorkspace(params: WorkspaceSearchParams) {
  const pattern = toLikePattern(params.query);
  const orgFilter = eq(posts.organizationId, params.organizationId);
  const projectCollectionIds = projectScopedCollectionIds(
    params.organizationId,
    params.projectId
  );
  const postFilter = projectCollectionIds
    ? and(orgFilter, inArray(posts.collectionId, projectCollectionIds))
    : orgFilter;

  const { projectId } = params;
  // Chats without a project are visible in every project.
  const chatProjectFilter = projectId
    ? or(eq(chatSessions.projectId, projectId), isNull(chatSessions.projectId))
    : undefined;

  const [
    postRows,
    voiceRows,
    referenceRows,
    githubRows,
    linearRows,
    socialRows,
    promptRows,
    competitorRows,
    personaRows,
    siteRows,
    chatRows,
  ] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        status: posts.status,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(
        and(
          postFilter,
          or(ilike(posts.title, pattern), ilike(posts.slug, pattern))
        )
      )
      .orderBy(desc(posts.updatedAt))
      .limit(params.limit),
    db
      .select({
        id: brandSettings.id,
        name: brandSettings.name,
        companyName: brandSettings.companyName,
        websiteUrl: brandSettings.websiteUrl,
        isDefault: brandSettings.isDefault,
      })
      .from(brandSettings)
      .where(
        and(
          eq(brandSettings.organizationId, params.organizationId),
          or(
            ilike(brandSettings.name, pattern),
            ilike(brandSettings.companyName, pattern),
            ilike(brandSettings.websiteUrl, pattern)
          )
        )
      )
      .orderBy(desc(brandSettings.updatedAt))
      .limit(params.limit),
    db
      .select({
        id: brandReferences.id,
        voiceId: brandReferences.brandSettingsId,
        type: brandReferences.type,
        content: brandReferences.content,
        note: brandReferences.note,
      })
      .from(brandReferences)
      .innerJoin(
        brandSettings,
        eq(brandReferences.brandSettingsId, brandSettings.id)
      )
      .where(
        and(
          eq(brandSettings.organizationId, params.organizationId),
          or(
            ilike(brandReferences.content, pattern),
            ilike(brandReferences.note, pattern)
          )
        )
      )
      .orderBy(desc(brandReferences.updatedAt))
      .limit(params.limit),
    db
      .select({
        id: githubIntegrations.id,
        displayName: githubIntegrations.displayName,
        owner: githubIntegrations.owner,
        repo: githubIntegrations.repo,
      })
      .from(githubIntegrations)
      .where(
        and(
          eq(githubIntegrations.organizationId, params.organizationId),
          or(
            ilike(githubIntegrations.displayName, pattern),
            ilike(githubIntegrations.owner, pattern),
            ilike(githubIntegrations.repo, pattern)
          )
        )
      )
      .orderBy(desc(githubIntegrations.updatedAt))
      .limit(params.limit),
    db
      .select({
        id: linearIntegrations.id,
        displayName: linearIntegrations.displayName,
        linearOrganizationName: linearIntegrations.linearOrganizationName,
        linearTeamName: linearIntegrations.linearTeamName,
      })
      .from(linearIntegrations)
      .where(
        and(
          eq(linearIntegrations.organizationId, params.organizationId),
          or(
            ilike(linearIntegrations.displayName, pattern),
            ilike(linearIntegrations.linearOrganizationName, pattern),
            ilike(linearIntegrations.linearTeamName, pattern)
          )
        )
      )
      .orderBy(desc(linearIntegrations.updatedAt))
      .limit(params.limit),
    db
      .select({
        id: connectedSocialAccounts.id,
        provider: connectedSocialAccounts.provider,
        username: connectedSocialAccounts.username,
        displayName: connectedSocialAccounts.displayName,
      })
      .from(connectedSocialAccounts)
      .where(
        and(
          eq(connectedSocialAccounts.organizationId, params.organizationId),
          or(
            ilike(connectedSocialAccounts.username, pattern),
            ilike(connectedSocialAccounts.displayName, pattern),
            ilike(connectedSocialAccounts.provider, pattern)
          )
        )
      )
      .orderBy(desc(connectedSocialAccounts.updatedAt))
      .limit(params.limit),
    projectId
      ? db
          .select({
            id: geoPrompts.id,
            prompt: geoPrompts.prompt,
            title: geoPrompts.title,
            enabled: geoPrompts.enabled,
          })
          .from(geoPrompts)
          .where(
            and(
              eq(geoPrompts.organizationId, params.organizationId),
              eq(geoPrompts.projectId, projectId),
              or(
                ilike(geoPrompts.prompt, pattern),
                ilike(geoPrompts.title, pattern)
              )
            )
          )
          .orderBy(desc(geoPrompts.updatedAt))
          .limit(params.limit)
      : [],
    projectId
      ? db
          .select({
            id: geoCompetitors.id,
            name: geoCompetitors.name,
            domain: geoCompetitors.domain,
          })
          .from(geoCompetitors)
          .where(
            and(
              eq(geoCompetitors.organizationId, params.organizationId),
              eq(geoCompetitors.projectId, projectId),
              or(
                ilike(geoCompetitors.name, pattern),
                ilike(geoCompetitors.domain, pattern)
              )
            )
          )
          .orderBy(desc(geoCompetitors.updatedAt))
          .limit(params.limit)
      : [],
    projectId
      ? db
          .select({
            id: geoPersonas.id,
            name: geoPersonas.name,
            role: geoPersonas.role,
            company: geoPersonas.company,
          })
          .from(geoPersonas)
          .where(
            and(
              eq(geoPersonas.organizationId, params.organizationId),
              eq(geoPersonas.projectId, projectId),
              isNull(geoPersonas.archivedAt),
              or(
                ilike(geoPersonas.name, pattern),
                ilike(geoPersonas.role, pattern),
                ilike(geoPersonas.company, pattern)
              )
            )
          )
          .orderBy(desc(geoPersonas.updatedAt))
          .limit(params.limit)
      : [],
    isSitesEnabledForOrganization(params.organizationId).then((enabled) =>
      enabled
        ? db
            .select({
              id: sites.id,
              name: sites.name,
              publicOrigin: sites.publicOrigin,
            })
            .from(sites)
            .where(
              and(
                eq(sites.organizationId, params.organizationId),
                or(
                  ilike(sites.name, pattern),
                  ilike(sites.slug, pattern),
                  ilike(sites.publicOrigin, pattern)
                )
              )
            )
            .orderBy(desc(sites.updatedAt))
            .limit(params.limit)
        : []
    ),
    db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.organizationId, params.organizationId),
          isNull(chatSessions.deletedAt),
          isNull(chatSessions.contentId),
          chatProjectFilter,
          ilike(chatSessions.title, pattern)
        )
      )
      .orderBy(desc(chatSessions.updatedAt))
      .limit(params.limit),
  ]);

  return {
    posts: postRows,
    voices: voiceRows,
    references: referenceRows,
    githubIntegrations: githubRows,
    linearIntegrations: linearRows,
    socialAccounts: socialRows,
    prompts: promptRows,
    competitors: competitorRows,
    personas: personaRows,
    sites: siteRows,
    chats: chatRows,
  };
}
