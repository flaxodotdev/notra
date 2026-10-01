import { afterEach, expect, test } from "bun:test";

import { assertAllowedSocialMediaUrls } from "./media-urls";

const R2_HOST = "https://cdn.example.com";
const APP_HOST = "https://app.example.com";

afterEach(() => {
  delete process.env.CLOUDFLARE_PUBLIC_URL;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

test("passes through empty input without env", () => {
  expect(() => assertAllowedSocialMediaUrls(undefined)).not.toThrow();
  expect(() => assertAllowedSocialMediaUrls([])).not.toThrow();
});

test("rejects relative media paths (PostForMe cannot fetch them)", () => {
  expect(() =>
    assertAllowedSocialMediaUrls(["/api/uploads/content-images/org_1/a.mp4"])
  ).toThrow("Media URL must be an absolute URL");
});

test("allows the configured R2 host, rejects app and other hosts", () => {
  process.env.CLOUDFLARE_PUBLIC_URL = R2_HOST;
  process.env.APP_URL = APP_HOST;
  expect(() =>
    assertAllowedSocialMediaUrls([`${R2_HOST}/organization/org_1/a.mp4`])
  ).not.toThrow();
  // App-origin media requires dashboard auth, which PostForMe lacks.
  expect(() =>
    assertAllowedSocialMediaUrls([
      `${APP_HOST}/api/uploads/content-images/a.mp4`,
    ])
  ).toThrow("Media URL host is not allowed");
  expect(() =>
    assertAllowedSocialMediaUrls(["https://evil.example.com/a.mp4"])
  ).toThrow("Media URL host is not allowed");
  expect(() =>
    assertAllowedSocialMediaUrls(["//evil.example.com/a.mp4"])
  ).toThrow("Media URL must be an absolute URL");
  expect(() => assertAllowedSocialMediaUrls(["not a url"])).toThrow(
    "Media URL must be an absolute URL"
  );
  expect(() =>
    assertAllowedSocialMediaUrls(["https://exa mple.com/a.mp4"])
  ).toThrow("Invalid media URL");
});
