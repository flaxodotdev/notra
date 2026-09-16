import { z } from "zod";

const pushCommitsSchema = z.object({
  commits: z.array(z.object({ message: z.string() }).loose()),
});

export function getPushCommitMessages(data: unknown): string[] {
  const parsed = pushCommitsSchema.safeParse(data);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.commits.map((commit) => commit.message);
}
