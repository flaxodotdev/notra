import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { SocialVideoAttachment as SocialVideoDraft } from "@notra/schemas/dashboard/content";
import type { ChangeEvent, ComponentProps, ReactElement } from "react";

import { MAX_CONTENT_VIDEO_BYTES } from "@/constants/content-video";
import type { UploadFileProps } from "@/types/upload/client";

if (process.env.NOTRA_SOCIAL_VIDEO_UPLOAD_TEST !== "1") {
  test("social video uploads validate actual bytes before uploading", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { PATH: process.env.PATH, NOTRA_SOCIAL_VIDEO_UPLOAD_TEST: "1" },
        timeout: 20_000,
      }
    );
    expect(child.status, child.stderr?.toString()).toBe(0);
  }, 25_000);
} else {
  const react = await import("react");
  let completed = Promise.resolve();
  let complete = () => {};
  let error: unknown = null;
  const inputRef = { current: { value: "selected" } };
  const upload = mock(async (input: UploadFileProps) => {
    expect(input.type).toBe("content");
    return {
      key: "organization/org_fixture/content/clip.mp4",
      url: "https://cdn.example.com/organization/org_fixture/content/clip.mp4",
    };
  });
  const onChange = mock((video: SocialVideoDraft | null) => {
    expect(video).not.toBeNull();
    complete();
  });
  const onUploadingChange = mock((_uploading: boolean) => {});
  const toastError = mock((_message: string) => {});

  mock.module("react", () => ({
    ...react,
    useRef: () => inputRef,
    useState: (initial: unknown) => [
      initial,
      (value: unknown) => {
        if (typeof value === "string") {
          error = value;
          complete();
        }
      },
    ],
  }));
  mock.module("use-intl", () => ({
    useTranslations: () => (key: string) => key,
  }));
  mock.module("sonner", () => ({ toast: { error: toastError } }));
  mock.module("lucide-react", () => ({ VideoIcon: "svg", XIcon: "svg" }));
  mock.module("@/components/button", () => ({ Button: "button" }));
  mock.module("@/lib/upload/client", () => ({ uploadFile: upload }));

  const { SocialVideoAttachment } =
    await import("../src/components/content/social-video-attachment");

  beforeEach(() => {
    completed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    error = null;
    inputRef.current.value = "selected";
    upload.mockClear();
    onChange.mockClear();
    onUploadingChange.mockClear();
    toastError.mockClear();
  });

  const chooseFile = async (file: File) => {
    const element = SocialVideoAttachment({
      value: null,
      onChange,
      onUploadingChange,
    }) as ReactElement<{
      children: ReactElement<ComponentProps<"input">>[];
    }>;
    const input = element.props.children[0];
    expect(input?.type).toBe("input");
    input?.props.onChange?.({
      target: { files: [file] },
    } as unknown as ChangeEvent<HTMLInputElement>);
    await completed;
    expect(inputRef.current.value).toBe("");
  };

  test("accepts a WebM with a padded EBML header larger than 4096 bytes", async () => {
    const bytes = new Uint8Array(5016);
    // EBML header size 5010; DocType webm followed by a 5000-byte Void.
    bytes.set([0x1a, 0x45, 0xdf, 0xa3, 0x53, 0x92]);
    bytes.set([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d], 6);
    bytes.set([0xec, 0x53, 0x88], 13);
    const file = new File([bytes], "clip.webm", { type: "video/webm" });
    await chooseFile(file);
    expect(error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0].file).toBe(file);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      mimeType: "video/webm",
      size: bytes.byteLength,
    });
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  test("normalizes an incorrect browser MIME to the sniffed MP4 bytes", async () => {
    const bytes = Uint8Array.from([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    const file = new File([bytes], "clip.bin", { type: "text/plain" });
    await chooseFile(file);
    expect(error).toBeNull();
    expect(upload).toHaveBeenCalledTimes(1);
    const normalized = upload.mock.calls[0]?.[0].file;
    if (!normalized) {
      throw new Error("Expected a normalized upload");
    }
    expect(normalized).not.toBe(file);
    expect(normalized.type).toBe("video/mp4");
    expect(normalized.name).toBe(file.name);
    expect(normalized.size).toBe(file.size);
    expect(new Uint8Array(await normalized.arrayBuffer())).toEqual(bytes);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      mimeType: "video/mp4",
      size: file.size,
    });
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  test("rejects invalid bytes despite a video MIME without uploading", async () => {
    await chooseFile(
      new File(["<video></video>"], "clip.mp4", { type: "video/mp4" })
    );
    expect(error).toBe("Use an MP4 or WebM video");
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });

  test("rejects a file above the video ceiling without uploading", async () => {
    await chooseFile(
      new File([new Uint8Array(MAX_CONTENT_VIDEO_BYTES + 1)], "clip.mp4", {
        type: "video/mp4",
      })
    );
    expect(error).toBe("videoTooLarge");
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(onUploadingChange).not.toHaveBeenCalled();
  });

  test("reports an asynchronous upload failure outside the attachment instance", async () => {
    upload.mockRejectedValueOnce(new Error("Upload disconnected"));
    const bytes = Uint8Array.from([
      0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
    ]);
    await chooseFile(new File([bytes], "clip.mp4", { type: "video/mp4" }));
    expect(toastError.mock.calls).toEqual([["videoUploadFailed"]]);
    expect(error).toBe("Upload disconnected");
    expect(onChange).not.toHaveBeenCalled();
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]]);
  });
}
