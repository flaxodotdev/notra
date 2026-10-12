import type { RailwayContext, RailwayContextInput } from "railway/iac";

export function assertTarget(
  context: RailwayContext,
  target: RailwayContextInput
) {
  if (
    context.projectId !== target.projectId ||
    context.environmentId !== target.environmentId ||
    (context.projectName != null &&
      context.projectName !== target.projectName) ||
    (context.environment != null && context.environment !== target.environment)
  ) {
    throw new Error(
      `Select the existing ${target.projectName} / ${target.environment} target before planning this configuration.`
    );
  }
}
