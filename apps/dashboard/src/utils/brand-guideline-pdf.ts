import { BRAND_GUIDELINE_PDF_MIME_TYPE } from "@notra/schemas/constants/dashboard/upload";

import { PDF_FILE_SIGNATURE } from "@/constants/brand-guidelines";
import type { GuidelineContentSummary } from "@/types/brand-guidelines";

/** Some browsers report an empty MIME type for PDFs, so fall back to the extension. */
export function isPdfFile(file: File) {
  return (
    file.type === BRAND_GUIDELINE_PDF_MIME_TYPE ||
    (file.type === "" && file.name.toLowerCase().endsWith(".pdf"))
  );
}

export function hasPdfSignature(bytes: Uint8Array) {
  return (
    new TextDecoder().decode(bytes.subarray(0, PDF_FILE_SIGNATURE.length)) ===
    PDF_FILE_SIGNATURE
  );
}

export function isGuidelinePdfKeyForOrganization(
  organizationId: string,
  key: string
) {
  return (
    key.startsWith(`organization/${organizationId}/brand-guidelines/`) &&
    key.toLowerCase().endsWith(".pdf") &&
    !key.includes("..")
  );
}

/**
 * A guideline PDF supplements generated guidelines, so it can only be added
 * once some exist. Partial runs (e.g. a failed screenshot step) count too.
 */
export function hasGeneratedGuidelines(summary: GuidelineContentSummary) {
  return (
    Boolean(summary.lastGeneratedAt) ||
    summary.assets.length > 0 ||
    summary.colors.length > 0 ||
    summary.fonts.length > 0 ||
    summary.tokens.length > 0 ||
    summary.screenshots.length > 0
  );
}
