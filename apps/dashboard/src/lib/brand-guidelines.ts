import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { ContextDevScreenshotResponse } from "@notra/ai/types/context-dev";
import { limitBrandGuidelineSourceText } from "@notra/ai/utils/brand-guideline-source";
import {
  captureScreenshot,
  isContextDevConfigured,
  parsePdfDocument,
  retrieveBrand,
  retrieveStyleguide,
} from "@notra/ai/utils/context-dev";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  brandGuidelineAssets,
  brandGuidelineColors,
  brandGuidelineFonts,
  brandGuidelineScreenshots,
  brandGuidelines,
  brandGuidelineTokens,
} from "@notra/db/schema";
import { MAX_BRAND_GUIDELINE_PDF_FILE_SIZE } from "@notra/schemas/constants/dashboard/upload";
import { and, asc, eq } from "drizzle-orm";

import {
  BRAND_GUIDELINE_DESKTOP_SCREENSHOT_CONFIG,
  BRAND_GUIDELINE_MAX_SCREENSHOT_SLICES,
  BRAND_GUIDELINE_SCREENSHOT_WAIT_MS,
  BRAND_GUIDELINE_TRAILING_SLASH_REGEX,
} from "@/constants/brand-guidelines";
import { getTranslations } from "@/lib/i18n/server";
import { getR2Config } from "@/lib/upload/r2";
import type {
  AttachBrandGuidelineSourcePdfInput,
  BrandGuidelineGenerationStepInput,
  BrandGuidelinePdfErrorKey,
  NormalizedScreenshot,
} from "@/types/brand-guidelines";
import {
  hasGeneratedGuidelines,
  hasPdfSignature,
  isGuidelinePdfKeyForOrganization,
} from "@/utils/brand-guideline-pdf";
import {
  dedupeColors,
  extractAssets,
  extractFonts,
  extractLogoColors,
  extractStyleguideColors,
  extractTokens,
  getBrandGuidelineHostname,
  getColorDedupeKey,
  getScreenshotUrl,
  normalizeBrandGuidelineSourceUrl,
  serializeGuidelinesResponse,
} from "@/utils/brand-guidelines";

function getScreenshotResponseHeight(response: ContextDevScreenshotResponse) {
  return typeof response.screenshot === "object"
    ? response.screenshot.height
    : response.height;
}

async function captureDesktopSlice(
  sourceUrl: string,
  scrollOffset: number,
  viewportHeight = BRAND_GUIDELINE_DESKTOP_SCREENSHOT_CONFIG.height
) {
  const config = BRAND_GUIDELINE_DESKTOP_SCREENSHOT_CONFIG;

  return captureScreenshot({
    directUrl: sourceUrl,
    handleCookiePopup: true,
    maxAgeMs: 0,
    scrollOffset,
    timeoutMS: 60_000,
    viewport: {
      height: viewportHeight,
      width: config.width,
    },
    waitForMs: BRAND_GUIDELINE_SCREENSHOT_WAIT_MS,
  });
}

async function captureDesktopScreenshots(sourceUrl: string) {
  const config = BRAND_GUIDELINE_DESKTOP_SCREENSHOT_CONFIG;
  const seenScreenshotUrls = new Set<string>();
  const responses: {
    response: ContextDevScreenshotResponse;
    scrollOffset: number;
  }[] = [];

  for (let index = 0; index < BRAND_GUIDELINE_MAX_SCREENSHOT_SLICES; index++) {
    const scrollOffset = index * config.height;
    const response = await captureDesktopSlice(sourceUrl, scrollOffset);

    const screenshotUrl = getScreenshotUrl(response);
    if (screenshotUrl) {
      if (seenScreenshotUrls.has(screenshotUrl)) {
        break;
      }
      seenScreenshotUrls.add(screenshotUrl);
    }

    const height = getScreenshotResponseHeight(response);

    if (height === undefined) {
      responses.push({ response, scrollOffset });
      break;
    }

    if (height <= 0) {
      break;
    }

    if (height >= config.height || scrollOffset === 0) {
      responses.push({ response, scrollOffset });
      if (height < config.height) {
        break;
      }
      continue;
    }

    const previous = responses.pop();
    if (!previous) {
      responses.push({ response, scrollOffset });
      break;
    }

    const mergedResponse = await captureDesktopSlice(
      sourceUrl,
      previous.scrollOffset,
      config.height + height
    );
    const mergedUrl = getScreenshotUrl(mergedResponse);
    const mergedHeight = getScreenshotResponseHeight(mergedResponse) ?? 0;

    if (mergedUrl && mergedHeight > config.height) {
      responses.push({
        response: mergedResponse,
        scrollOffset: previous.scrollOffset,
      });
    } else {
      responses.push(previous);
    }
    break;
  }

  return responses;
}

async function getGuidelineByBrandSettingsId(brandSettingsId: string) {
  return db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
    with: {
      assets: { orderBy: [asc(brandGuidelineAssets.sortOrder)] },
      colors: { orderBy: [asc(brandGuidelineColors.sortOrder)] },
      fonts: { orderBy: [asc(brandGuidelineFonts.sortOrder)] },
      screenshots: { orderBy: [asc(brandGuidelineScreenshots.sortOrder)] },
      tokens: { orderBy: [asc(brandGuidelineTokens.sortOrder)] },
    },
  });
}

export async function getBrandGuidelines(brandSettingsId: string) {
  return serializeGuidelinesResponse(
    await getGuidelineByBrandSettingsId(brandSettingsId)
  );
}

function resolveGuidelineDomain(sourceUrl: string) {
  return getBrandGuidelineHostname(normalizeBrandGuidelineSourceUrl(sourceUrl));
}

async function requireGuidelineId(brandSettingsId: string) {
  const guideline = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
    columns: { id: true },
  });

  if (!guideline) {
    throw new Error("Brand guideline record not found");
  }

  return guideline.id;
}

async function mergeGuidelineMeta(
  guidelineId: string,
  meta: Record<string, unknown>
) {
  const existing = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.id, guidelineId),
    columns: { contextDevMeta: true },
  });
  const current =
    existing?.contextDevMeta &&
    typeof existing.contextDevMeta === "object" &&
    !Array.isArray(existing.contextDevMeta)
      ? (existing.contextDevMeta as Record<string, unknown>)
      : {};

  return { ...current, ...meta };
}

export async function startBrandGuidelineGeneration(brandSettingsId: string) {
  const now = new Date();
  const existing = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(brandGuidelines)
      .set({
        status: "generating",
        lastGenerationError: null,
        updatedAt: now,
      })
      .where(eq(brandGuidelines.id, existing.id));
    return existing.id;
  }

  const guidelineId = crypto.randomUUID();
  await db.insert(brandGuidelines).values({
    id: guidelineId,
    brandSettingsId,
    status: "generating",
    lastGenerationError: null,
    createdAt: now,
    updatedAt: now,
  });
  return guidelineId;
}

export async function applyBrandGuidelineStyleguideStep(
  input: BrandGuidelineGenerationStepInput
) {
  const domain = resolveGuidelineDomain(input.sourceUrl);
  const guidelineId = await requireGuidelineId(input.brandSettingsId);
  const styleguide = await retrieveStyleguide(domain);

  const colors = dedupeColors(extractStyleguideColors(styleguide));
  const fonts = extractFonts(styleguide);
  const tokens = extractTokens(styleguide);
  const contextDevMeta = await mergeGuidelineMeta(guidelineId, {
    styleguide: { code: styleguide.code, status: styleguide.status },
  });
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(brandGuidelineColors)
      .where(eq(brandGuidelineColors.guidelineId, guidelineId));
    await tx
      .delete(brandGuidelineFonts)
      .where(eq(brandGuidelineFonts.guidelineId, guidelineId));
    await tx
      .delete(brandGuidelineTokens)
      .where(eq(brandGuidelineTokens.guidelineId, guidelineId));

    if (colors.length > 0) {
      await tx.insert(brandGuidelineColors).values(
        colors.map((color) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...color,
        }))
      );
    }

    if (fonts.length > 0) {
      await tx.insert(brandGuidelineFonts).values(
        fonts.map((font) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...font,
        }))
      );
    }

    if (tokens.length > 0) {
      await tx.insert(brandGuidelineTokens).values(
        tokens.map((token) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...token,
        }))
      );
    }

    await tx
      .update(brandGuidelines)
      .set({ contextDevMeta, updatedAt: now })
      .where(eq(brandGuidelines.id, guidelineId));
  });

  return {
    colorCount: colors.length,
    fontCount: fonts.length,
    tokenCount: tokens.length,
  };
}

export async function applyBrandGuidelineBrandStep(
  input: BrandGuidelineGenerationStepInput
) {
  const domain = resolveGuidelineDomain(input.sourceUrl);
  const guidelineId = await requireGuidelineId(input.brandSettingsId);
  const brand = await retrieveBrand(domain);

  const assets = extractAssets(brand);
  const existingColors = await db.query.brandGuidelineColors.findMany({
    where: eq(brandGuidelineColors.guidelineId, guidelineId),
    columns: { role: true, lightValue: true, darkValue: true },
  });
  const existingColorKeys = new Set(existingColors.map(getColorDedupeKey));
  const logoColors = dedupeColors(
    extractLogoColors(brand, existingColors.length)
  ).filter((color) => !existingColorKeys.has(getColorDedupeKey(color)));
  const contextDevMeta = await mergeGuidelineMeta(guidelineId, {
    brand: { code: brand.code, status: brand.status },
  });
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(brandGuidelineAssets)
      .where(eq(brandGuidelineAssets.guidelineId, guidelineId));

    if (assets.length > 0) {
      await tx.insert(brandGuidelineAssets).values(
        assets.map((asset) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...asset,
        }))
      );
    }

    if (logoColors.length > 0) {
      await tx.insert(brandGuidelineColors).values(
        logoColors.map((color) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...color,
        }))
      );
    }

    await tx
      .update(brandGuidelines)
      .set({ contextDevMeta, updatedAt: now })
      .where(eq(brandGuidelines.id, guidelineId));
  });

  return { assetCount: assets.length, logoColorCount: logoColors.length };
}

export async function applyBrandGuidelineScreenshotsStep(
  input: BrandGuidelineGenerationStepInput
) {
  const guidelineId = await requireGuidelineId(input.brandSettingsId);
  const screenshotResponses = await captureDesktopScreenshots(input.sourceUrl);
  const capturedAt = new Date();
  const config = BRAND_GUIDELINE_DESKTOP_SCREENSHOT_CONFIG;

  const slices = screenshotResponses.map(
    ({ response, scrollOffset }, index) => {
      const url = getScreenshotUrl(response);

      if (!url) {
        throw new Error(
          `Screenshot capture did not return an image for ${config.kind}`
        );
      }

      return {
        format:
          (typeof response.screenshot === "object"
            ? response.screenshot.format
            : undefined) ?? "png",
        height:
          (typeof response.screenshot === "object"
            ? response.screenshot.height
            : response.height) ?? config.height,
        index,
        scrollOffset,
        screenshotType: response.screenshotType,
        url,
        width:
          (typeof response.screenshot === "object"
            ? response.screenshot.width
            : response.width) ?? config.width,
      };
    }
  );

  const firstSlice = slices[0];
  const screenshots: NormalizedScreenshot[] = firstSlice
    ? [
        {
          capturedAt,
          format: firstSlice.format,
          fullPage: config.fullPage,
          height: firstSlice.height,
          kind: config.kind,
          metadata: {
            code: screenshotResponses[0]?.response.code,
            domain: screenshotResponses[0]?.response.domain,
            scrollOffset: firstSlice.scrollOffset,
            slices,
            status: screenshotResponses[0]?.response.status,
          },
          sortOrder: config.sortOrder,
          storageKey: null,
          url: firstSlice.url,
          width: firstSlice.width,
        },
      ]
    : [];

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .delete(brandGuidelineScreenshots)
      .where(eq(brandGuidelineScreenshots.guidelineId, guidelineId));

    if (screenshots.length > 0) {
      await tx.insert(brandGuidelineScreenshots).values(
        screenshots.map((screenshot) => ({
          id: crypto.randomUUID(),
          guidelineId,
          ...screenshot,
        }))
      );
    }
  });

  await db
    .update(brandGuidelines)
    .set({
      status: "ready",
      lastGeneratedAt: now,
      lastGenerationError: null,
      updatedAt: now,
    })
    .where(eq(brandGuidelines.id, guidelineId));

  return { screenshotCount: screenshots.length, sliceCount: slices.length };
}

export async function markBrandGuidelinesFailed(input: {
  brandSettingsId: string;
  error: string;
}) {
  const now = new Date();
  const existing = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, input.brandSettingsId),
    columns: { id: true },
  });

  if (existing) {
    await db
      .update(brandGuidelines)
      .set({
        status: "failed",
        lastGenerationError: input.error,
        updatedAt: now,
      })
      .where(eq(brandGuidelines.id, existing.id));
    return;
  }

  await db.insert(brandGuidelines).values({
    id: crypto.randomUUID(),
    brandSettingsId: input.brandSettingsId,
    status: "failed",
    lastGenerationError: input.error,
    createdAt: now,
    updatedAt: now,
  });
}

export class BrandGuidelineSourcePdfValidationError extends Error {
  override name = "BrandGuidelineSourcePdfValidationError";
}

async function guidelinePdfError(key: BrandGuidelinePdfErrorKey) {
  const t = await getTranslations("errors.brandGuidelinePdf");
  return new BrandGuidelineSourcePdfValidationError(t(key));
}

async function assertGuidelinePdfKey(organizationId: string, key: string) {
  if (!isGuidelinePdfKeyForOrganization(organizationId, key)) {
    throw await guidelinePdfError("invalidFile");
  }
}

async function deleteGuidelinePdfIfUnreferenced(key: string) {
  try {
    const referencing = await db.query.brandGuidelines.findFirst({
      where: eq(brandGuidelines.sourcePdfStorageKey, key),
      columns: { id: true },
    });
    if (referencing) {
      return;
    }
    const { bucketName, client } = getR2Config();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucketName, Key: key })
    );
  } catch (error) {
    logError("Failed to delete brand guideline PDF", error, { key });
  }
}

async function readGuidelinePdfText(key: string) {
  if (!isContextDevConfigured()) {
    throw await guidelinePdfError("unavailable");
  }

  const { bucketName, client } = getR2Config();
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (
    !object.Body ||
    (object.ContentLength ?? 0) > MAX_BRAND_GUIDELINE_PDF_FILE_SIZE
  ) {
    throw await guidelinePdfError("invalidFile");
  }
  const bytes = new Uint8Array(await object.Body.transformToByteArray());
  if (
    bytes.byteLength > MAX_BRAND_GUIDELINE_PDF_FILE_SIZE ||
    !hasPdfSignature(bytes)
  ) {
    throw await guidelinePdfError("invalidFile");
  }

  let markdown: string;
  try {
    markdown = await parsePdfDocument(bytes);
  } catch (error) {
    logError("Failed to parse brand guideline PDF", error, { key });
    throw await guidelinePdfError("readFailed");
  }

  const text = limitBrandGuidelineSourceText(markdown);
  if (!text) {
    throw await guidelinePdfError("noText");
  }
  return text;
}

export async function attachBrandGuidelineSourcePdf(
  input: AttachBrandGuidelineSourcePdfInput
) {
  await assertGuidelinePdfKey(input.organizationId, input.key);

  let replacedKey: string | null;
  try {
    const guideline = await getGuidelineByBrandSettingsId(
      input.brandSettingsId
    );
    if (!(guideline && hasGeneratedGuidelines(guideline))) {
      throw await guidelinePdfError("generateFirst");
    }

    const text = await readGuidelinePdfText(input.key);
    const now = new Date();

    // Row lock so concurrent replaces each know which key they replaced.
    replacedKey = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ sourcePdfStorageKey: brandGuidelines.sourcePdfStorageKey })
        .from(brandGuidelines)
        .where(eq(brandGuidelines.id, guideline.id))
        .for("update");
      await tx
        .update(brandGuidelines)
        .set({
          sourcePdfFilename: input.filename.trim(),
          sourcePdfStorageKey: input.key,
          sourcePdfText: text,
          sourcePdfUploadedAt: now,
          sourcePdfUrl: `${getR2Config().publicUrl.replace(BRAND_GUIDELINE_TRAILING_SLASH_REGEX, "")}/${input.key}`,
          updatedAt: now,
        })
        .where(eq(brandGuidelines.id, guideline.id));
      return locked?.sourcePdfStorageKey ?? null;
    });
  } catch (error) {
    // The key may belong to another voice of the same org, so only delete
    // it when no row references it.
    await deleteGuidelinePdfIfUnreferenced(input.key);
    throw error;
  }

  if (replacedKey && replacedKey !== input.key) {
    await deleteGuidelinePdfIfUnreferenced(replacedKey);
  }

  return getBrandGuidelines(input.brandSettingsId);
}

export async function removeBrandGuidelineSourcePdf(brandSettingsId: string) {
  const existing = await db.query.brandGuidelines.findFirst({
    where: eq(brandGuidelines.brandSettingsId, brandSettingsId),
    columns: { id: true, sourcePdfStorageKey: true },
  });
  if (!existing?.sourcePdfStorageKey) {
    return getBrandGuidelines(brandSettingsId);
  }

  // Compare-and-set on the key so a concurrent replace is never cleared.
  const cleared = await db
    .update(brandGuidelines)
    .set({
      sourcePdfFilename: null,
      sourcePdfStorageKey: null,
      sourcePdfText: null,
      sourcePdfUploadedAt: null,
      sourcePdfUrl: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(brandGuidelines.id, existing.id),
        eq(brandGuidelines.sourcePdfStorageKey, existing.sourcePdfStorageKey)
      )
    )
    .returning({ id: brandGuidelines.id });
  if (cleared.length > 0) {
    await deleteGuidelinePdfIfUnreferenced(existing.sourcePdfStorageKey);
  }
  return getBrandGuidelines(brandSettingsId);
}
