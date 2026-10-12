import { Schema } from "effect";

export class PostNotFoundError extends Schema.TaggedError<PostNotFoundError>()(
  "PostNotFoundError",
  {}
) {}

export class PostSlugNotSupportedError extends Schema.TaggedError<PostSlugNotSupportedError>()(
  "PostSlugNotSupportedError",
  {}
) {}

export class PostMetadataNotSupportedError extends Schema.TaggedError<PostMetadataNotSupportedError>()(
  "PostMetadataNotSupportedError",
  {}
) {}

/** metadata.authorIds names an author that is not in this organization. */
export class PostUnknownAuthorError extends Schema.TaggedError<PostUnknownAuthorError>()(
  "PostUnknownAuthorError",
  {}
) {}

export class PostInvalidMarkdownError extends Schema.TaggedError<PostInvalidMarkdownError>()(
  "PostInvalidMarkdownError",
  {}
) {}

export class PostSlugDuplicateError extends Schema.TaggedError<PostSlugDuplicateError>()(
  "PostSlugDuplicateError",
  {}
) {}

export class PostConcurrentModificationError extends Schema.TaggedError<PostConcurrentModificationError>()(
  "PostConcurrentModificationError",
  {}
) {}

export class PostGenerationJobNotFoundError extends Schema.TaggedError<PostGenerationJobNotFoundError>()(
  "PostGenerationJobNotFoundError",
  {}
) {}

export class PostGenerationQueueFailedError extends Schema.TaggedError<PostGenerationQueueFailedError>()(
  "PostGenerationQueueFailedError",
  { jobId: Schema.optional(Schema.String) }
) {}

/** A requested repository, Linear integration or brand voice is not usable by this organization. */
export class PostGenerationTargetUnavailableError extends Schema.TaggedError<PostGenerationTargetUnavailableError>()(
  "PostGenerationTargetUnavailableError",
  { message: Schema.String }
) {}

export class PostDatabaseError extends Schema.TaggedError<PostDatabaseError>()(
  "PostDatabaseError",
  { cause: Schema.Defect() }
) {}
