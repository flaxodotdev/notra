import { expect, test } from "bun:test";

import { createRailwayContext, project } from "railway/iac";

import aiTraffic, { partial } from "../ai-traffic.ts";
import { importedVariables } from "../constants/imported-variables.ts";
import { demoTarget, productionTarget } from "../constants/targets.ts";
import demo from "../demo.ts";

test("demo reuses only the existing API and dashboard", async () => {
  const definition = await demo(createRailwayContext(demoTarget), project);
  const resources = definition.resources?.flat() ?? [];

  expect(definition.name).toBe("notra-demo");
  expect(resources.map((resource) => resource.address)).toEqual([
    "service.demo-api",
    "service.dashboard",
  ]);
  expect(resources).toMatchObject([
    {
      source: { rootDirectory: "/" },
      build: { dockerfilePath: "apps/api/Dockerfile" },
      deploy: {
        multiRegionConfig: { "us-east4-eqdc4a": { numReplicas: 1 } },
      },
      networking: { customDomains: { "demo-api.usenotra.com": {} } },
    },
    {
      build: { dockerfilePath: "apps/dashboard/Dockerfile" },
      deploy: {
        healthcheckPath: "/api/healthcheck",
        healthcheckTimeout: 300,
        multiRegionConfig: { "us-east4-eqdc4a": { numReplicas: 1 } },
        preDeployCommand: [
          "sh -c 'if [ -x /migrate/run.sh ]; then /migrate/run.sh; else cd /app && DATABASE_URL=$MIGRATION_DATABASE_URL bun run db:migrate; fi'",
        ],
      },
      networking: { customDomains: { "demo.usenotra.com": {} } },
      variables: { MIGRATION_DATABASE_URL: { type: "preserve" } },
    },
  ]);
});

test("AI traffic owns only ingest and retains its two replicas", async () => {
  const definition = await aiTraffic(
    createRailwayContext(productionTarget),
    project
  );
  const resources = definition.resources?.flat() ?? [];

  expect(partial).toBe("ai-traffic");
  expect(definition.name).toBe("notra-prod");
  expect(resources.map((resource) => resource.address)).toEqual([
    "service.ai-traffic-ingest",
  ]);
  expect(resources).toMatchObject([
    {
      source: { rootDirectory: "/" },
      build: { dockerfilePath: "apps/ai-traffic-ingest/Dockerfile" },
      deploy: {
        healthcheckPath: "/readyz",
        healthcheckTimeout: 60,
        multiRegionConfig: { "us-east4-eqdc4a": { numReplicas: 2 } },
        drainingSeconds: 60,
        restartPolicyMaxRetries: 5,
      },
      networking: {
        customDomains: { "ingest.usenotra.com": { port: 3000 } },
      },
      variables: {
        TINYBIRD_BASE_URL: { type: "preserve" },
        TINYBIRD_TOKEN: { type: "preserve" },
      },
    },
  ]);
});

test.each([
  { name: "demo", program: demo, target: demoTarget },
  { name: "AI traffic", program: aiTraffic, target: productionTarget },
])(
  "$name preserves variables and does not restore autodeploys",
  async ({ program, target }) => {
    const definition = await program(createRailwayContext(target), project);

    for (const resource of definition.resources?.flat() ?? []) {
      expect(resource.type).toBe("service");
      if (resource.type === "service") {
        expect(resource.source).toMatchObject({
          type: "github",
          repo: "usenotra/notra",
        });
        expect(resource.source?.branch).toBeUndefined();
        expect(resource.build?.watchPatterns).toBeUndefined();
        expect(resource.configFile).toBeUndefined();
        expect(resource.variables).toMatchObject({
          DATABASE_URL: { type: "preserve" },
          GEO_INGEST_SECRET: { type: "preserve" },
          UPSTASH_REDIS_REST_TOKEN: { type: "preserve" },
          UPSTASH_REDIS_REST_URL: { type: "preserve" },
        });
        expect(Object.keys(resource.variables ?? {}).sort()).toEqual(
          [
            ...importedVariables[
              resource.name as keyof typeof importedVariables
            ],
          ].sort()
        );
        for (const variable of Object.values(resource.variables ?? {})) {
          expect(variable).toEqual({ type: "preserve" });
        }
      }
    }
  }
);

test.each([
  { name: "demo", program: demo, target: demoTarget },
  { name: "AI traffic", program: aiTraffic, target: productionTarget },
])(
  "$name rejects missing or incorrect Railway context",
  ({ program, target }) => {
    for (const context of [
      {},
      { ...target, projectId: "another-project" },
      { ...target, environmentId: "another-environment" },
      { ...target, environment: "staging" },
      { ...target, projectName: "another-project" },
      { projectName: target.projectName, environment: target.environment },
    ]) {
      expect(() => program(createRailwayContext(context), project)).toThrow(
        "before planning"
      );
    }
  }
);

test.each([
  { name: "demo", program: demo, target: demoTarget },
  { name: "AI traffic", program: aiTraffic, target: productionTarget },
])(
  "$name accepts exact CLI IDs without optional names",
  async ({ program, target }) => {
    const expected = await program(createRailwayContext(target), project);
    const idContext = createRailwayContext({
      projectId: target.projectId,
      environmentId: target.environmentId,
    });
    expect(await program(idContext, project)).toEqual(expected);
    expect(
      await program(
        Object.assign(idContext, { projectName: null, environment: null }),
        project
      )
    ).toEqual(expected);
  }
);
