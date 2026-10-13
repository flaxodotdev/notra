"use client";

import type { SocialVideoAttachment as SocialVideoDraft } from "@notra/schemas/dashboard/content";
import { VideoIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentVideoPlayer } from "@/components/content/editor/nodes/content-video-player";
import type { ContentVideoMimeType } from "@/constants/content-video";
import { SOCIAL_VIDEO } from "@/constants/social-video";
import { uploadFile } from "@/lib/upload/client";
import { validateContentVideo } from "@/utils/validate-content-video";

interface SocialVideoAttachmentProps {
  value: SocialVideoDraft | null;
  onChange: (video: SocialVideoDraft | null) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

async function sniffFile(file: File): Promise<ContentVideoMimeType> {
  // EBML headers can exceed 4 KiB; the size gate bounds this full-file read.
  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateContentVideo(bytes);
}

export function SocialVideoAttachment({
  value,
  onChange,
  disabled,
  onUploadingChange,
}: SocialVideoAttachmentProps) {
  const t = useTranslations("content.postSocial");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUploadingState = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > SOCIAL_VIDEO.maxBytes) {
      setError(t("videoTooLarge", { maxMb: SOCIAL_VIDEO.maxBytesMb }));
      // Leave the rejected file selected and the same pick fires no change
      // event — reset so retrying the same file works.
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }
    setUploadingState(true);
    try {
      const mimeType = await sniffFile(file);
      // The presigned upload trusts `file.type` for validation and the
      // stored Content-Type — normalize to the sniffed bytes so a wrong
      // browser MIME can neither bypass the gate nor mistype the object.
      const normalized =
        file.type === mimeType
          ? file
          : new File([file], file.name, { type: mimeType });
      const { url, key } = await uploadFile({
        file: normalized,
        type: "content",
      });
      onChange({ key, url, mimeType, size: file.size });
    } catch (cause) {
      // The dialog may have unmounted this input while the upload was running.
      toast.error(t("videoUploadFailed"));
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : t("videoUploadFailed")
      );
    } finally {
      setUploadingState(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  if (value) {
    return (
      <div className="space-y-2">
        <ContentVideoPlayer
          key={value.url}
          src={value.url}
          videoClassName="max-h-56"
        />
        {!disabled && (
          <Button onClick={() => onChange(null)} size="sm" variant="ghost">
            <XIcon data-icon="inline-start" />
            {t("removeVideo")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        accept={SOCIAL_VIDEO.accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
        ref={inputRef}
        type="file"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={disabled}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          variant="outline"
        >
          <VideoIcon data-icon="inline-start" />
          {uploading ? t("uploadingVideo") : t("attachVideo")}
        </Button>
        <p className="text-muted-foreground text-xs">
          {t("attachVideoHint", { maxMb: SOCIAL_VIDEO.maxBytesMb })}
        </p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
