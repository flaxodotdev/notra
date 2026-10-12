import { z } from "astro/zod";

export const blogEntrySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  author: z.union([z.string(), z.array(z.string())]).optional(),
  image: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  noindex: z.boolean().default(false),
});

export const changelogEntrySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  version: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
  image: z.string().optional(),
  draft: z.boolean().default(false),
});
