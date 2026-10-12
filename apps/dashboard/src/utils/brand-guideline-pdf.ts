import { BRAND_GUIDELINE_PDF_MIME_TYPE } from "@notra/schemas/constants/dashboard/upload";

import { PDF_FILE_SIGNATURE } from "@/constants/brand-guidelines";

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
