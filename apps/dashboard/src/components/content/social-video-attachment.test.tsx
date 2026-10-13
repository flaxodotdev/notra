import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../../../messages/en.json";
import { ContentVideoPlayer } from "./editor/nodes/content-video-player";
import { SocialVideoAttachment } from "./social-video-attachment";

test("social attachments use the compact custom player and accessible controls", () => {
  const html = renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <SocialVideoAttachment
        onChange={() => {}}
        value={{
          key: "organization/org/content/clip.mp4",
          url: "https://cdn.example.com/organization/org/content/clip.mp4",
          mimeType: "video/mp4",
          size: 16,
        }}
      />
    </IntlProvider>
  );
  const video = html.match(/<video[^>]*>/)?.[0];
  expect(video).toContain("max-h-56");
  expect(video).not.toContain("max-h-128");
  expect(video).not.toMatch(/\scontrols(?:[\s=>])/);
  expect(video).toContain('playsInline=""');
  for (const label of ["Play", "Seek", "Mute", "Full screen"]) {
    expect(html).toContain(`aria-label="${label}"`);
  }
  expect(html).toContain('aria-valuetext="0:00 / 0:00"');
  expect(html).toContain("Remove video");
});

test("the editor retains its original video sizing", () => {
  const html = renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <ContentVideoPlayer src="https://cdn.example.com/clip.mp4" />
    </IntlProvider>
  );
  expect(html).toContain("max-h-128");
  expect(html).not.toContain("max-h-56");
});
