export const DEMO_API_URL =
  process.env.NOTRA_DEMO_API_URL ?? "https://demo-api.usenotra.com";

/**
 * Largest request body demo-api accepts. Bodies are buffered for the request
 * feed before auth runs, so anonymous callers must not pick their size. The
 * largest legitimate payloads (a 1 MB CSV import JSON-escaped, or a full
 * 2,000-row competitor import with synonyms) stay well below it.
 */
export const DEMO_API_MAX_BODY_BYTES = 5 * 1024 * 1024;
