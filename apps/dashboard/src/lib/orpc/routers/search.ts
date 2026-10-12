import { globalSearchInputSchema } from "@notra/schemas/dashboard/search";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import { baseProcedure } from "@/lib/orpc/base";
import { searchWorkspace } from "@/lib/search/workspace-search";

export const searchRouter = {
  global: baseProcedure
    .input(globalSearchInputSchema)
    .handler(async ({ context, input }) => {
      await assertOrganizationAccess({
        headers: context.headers,
        organizationId: input.organizationId,
      });
      return searchWorkspace(input);
    }),
};
