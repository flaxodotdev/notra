# Railway infrastructure

These explicit configurations target existing resources in different projects.
Always pass `--file`; there is no default `.railway/railway.ts`.

| File | Project / environment | Managed resources | Ownership |
| --- | --- | --- | --- |
| `demo.ts` | `notra-demo` / `production` | `demo-api`, `dashboard` | Whole demo environment |
| `ai-traffic.ts` | `notra-prod` / `production` | `ai-traffic-ingest` | Named partial `ai-traffic` |
| `observability.ts` | `notra-prod` / `production` | Seven monitoring services and four volumes | Named partial `observability` |

## Monitoring infrastructure

`.railway/observability.ts` describes the **seven monitoring services and four existing
volumes** in `notra-prod / production`. Shared deployment/storage settings live in
`constants/observability.ts`; the SDK is pinned in the root dev dependencies.

The named `observability` partial deliberately limits this adoption to monitoring.
The application's `ai-traffic-ingest` service remains outside monitoring ownership
and is declared separately by the `ai-traffic` partial. Do
not remove or rename the partial, or import the whole environment over this file.
A whole-project file can delete omitted resources. Expanding ownership requires
an explicit migration and a newly reviewed plan.

## Check and plan

From the repository root:

```sh
bun install --frozen-lockfile
bun --no-env-file run railway:check
bun --no-env-file test --isolate infra/observability
railway link --project notra-prod --environment production
railway config plan --file .railway/observability.ts --detailed-exit-code
```

Use Railway CLI **5.63.0 or newer**. The authoring file rejects another project or
environment. `link` only selects local CLI context; `plan` does not apply changes.
Detailed exit codes are 0 for no change, 2 for pending changes, and another nonzero
code for an error. Review every resource and volume change before any apply.

On **2026-10-10**, the live plan reported the configuration already up to date:
no additions, changes or deletions. After user approval, that pinned plan was
applied and Railway ownership was registered for exactly six services and four
volumes under `observability`. The subsequent plan also reported no changes.
All six deployment IDs and four volume IDs remained unchanged; the existing
volumes were `READY`. The application ingest deployment was unchanged and is not
owned by the partial. All 71 post-adoption live checks passed, as did 32 local
infrastructure tests and the IaC typecheck. Always obtain a fresh plan before
subsequent changes.

The subsequently approved extension added only `vercel-metrics` (service
`f06fc2aa-26b6-420a-8077-094555f429ad`), bringing partial ownership to eleven
resources. The saved one-create/no-update/no-delete plan was applied on
2026-10-10 and the follow-up plan reported no changes. Existing volumes and
application services were not changed by this apply. The exporter has no
deployment yet: token creation through the Vercel API returned 403. Provision a
separate 90-day Notra-team token as sealed `VERCEL_MONITORING_TOKEN` before
uploading its Docker context; never deploy the user's CLI authentication token.

## Scope and deployment

- Existing names are adoption identities. Do not rename services or volumes.
- Services remain private, with one US East/Virginia replica configured
  (`us-east4-eqdc4a`), matching the production ingest service. Cloudflare DNS, Access and the
  tunnel's remote ingress remain separately managed, not part of Railway IaC.
  The rendered configuration explicitly empties Railway-generated domains as
  well as custom domains and TCP proxies; `domains: []` alone covers only custom
  domains in the pinned SDK. This source change requires a separately reviewed
  plan before any future apply; no live change is implied.
- Secret variables use `preserve()`: no secrets are stored in source. On a fresh
  project they must be provisioned separately; this file targets existing resources.
- `PORT` and runtime bootstrap users are explicit. Volume-backed services keep
  root initialization before dropping privileges in their Docker entrypoints.
- Volumes retain their imported identities, mounts, 50,000-MB allocations, online-resize
  setting and usage alert thresholds. These are not a backup strategy.
- Build sources remain unset, matching the live services. IaC manages service
  settings; it does **not** upload Docker contexts, deploy app code or enable
  production application telemetry. Continue using the explicit per-service
  `railway up ... --path-as-root` workflow in
  [`infra/observability/README.md`](../infra/observability/README.md).
- Do not add a GitHub source without reviewing the Docker build context and
  deployment triggers. Each Dockerfile currently expects its own directory root.
- The unused monitoring `railway.json` files were replaced, not retained as a
  competing source of configuration. No remote config-file setting was changed.

Never apply from automation or an agent without approval of the exact reviewed
plan. Plan artifacts may contain sensitive state: keep them outside `.railway/`
and outside source control. No deployment or automatic apply workflow is added.

## US East migration

The requested region change was approved and applied on **2026-10-10**, moving
monitoring to `us-east4-eqdc4a`. All six runnable service deployments reached
`SUCCESS`; Vercel remains undeployed pending its separate token. All four active
volume instances are `READY` in US East; logical volume IDs, mounts and 50,000-MB
allocations are unchanged. Railway assigned new underlying volume-instance IDs
during migration. Four pre-migration recovery snapshots were created and listed;
a restoration drill was not performed. Existing Prometheus history and Loki
validation events remain queryable, and all four dashboards match source. All ten
runnable scrape targets and five probes are healthy; Access redirects anonymous
Grafana requests and OTLP rejects unauthenticated requests.

CLI 5.63.4's native IaC plan omitted service replica-region changes and reported
only the four volume-region changes. That incomplete pinned plan was **not
applied**. After explicit approval of the exact seven-service/four-volume patch,
the migration used `railway environment edit --json`, explicitly removing EU
replicas and assigning one US East replica. A complete before/after comparison
confirmed only approved region fields changed, with application config untouched.
The post-migration IaC plan reports no changes; independently verify live region
placement rather than relying on that planner alone. Evidence is kept in protected
`notra-us-east-*` artifacts outside source control.

For future migrations, change all seven
monitoring services and the four existing volumes together, keeping their names,
mounts, secrets, domains and data. Do not recreate or detach volumes, reset data,
or change application services. Railway migrates attached volume data when
changing region, with downtime for the volume-backed service; duration depends
on the stored data and must not be promised in advance.

Before apply, take and verify recovery backups of the four monitoring volumes.
After migration, verify each deployment, volume readiness and US East placement,
Grafana data/dashboards, private Prometheus/Loki/collector health and all probes.
Vercel stays undeployed pending its separate token; migration must not activate
application telemetry or substitute a personal Vercel credential. Probes then
measure availability from US East, not EU. See
<https://docs.railway.com/deployments/regions> for volume migration semantics.

## Demo and AI traffic infrastructure

These TypeScript definitions describe **existing** Railway services. They do not
provision a replacement stack, copy secrets, or deploy application code.

`notra-prod` already has an `observability` partial. Its services and volumes are
not declared here and must remain with that owner. Do not remove the `ai-traffic`
partial export, rename it after adoption, or import the whole production project
into this file. A named partial only deletes omitted resources it owns; a whole
project definition can delete omitted resources across the environment.

## What stays the same

- Existing service names bind to existing Railway resources. No database, Redis
  instance, bucket, or volume is created. Existing database, Upstash, Tinybird, and
  other integrations continue through their existing variables.
- All imported variables use `preserve()`, including non-secret values. This
  retains their values and references in Railway; it cannot initialize a new
  environment. Do not use `config pull --include-variables` or commit plan
  artifacts containing values.
- The GitHub repository stays connected. Each source explicitly uses
  `branch: null`: `github()` otherwise defaults to `main`. Omitting `source`
  altogether proposes removing the connection with CLI 5.63.4. The demo API and
  ingest retain `rootDirectory: "/"`; the dashboard retains its existing empty
  root, also the monorepo root. Do not set an app subdirectory as the build root.
- Current Dockerfile paths, custom domains, healthchecks, replica placement,
  ingest draining/retry settings, and dashboard pre-deploy migration are retained.
  Ingest has **two** Virginia replicas; each demo service has one.
- No GitHub deployment branch or watch patterns are restored. Application releases
  still run through `scripts/github/production-deploy.mjs` after Vercel succeeds,
  using the checked release commit. IaC is not read during application builds.

## Check locally (no Railway credentials needed)

Use the repository's Bun and Node versions, install with `bun install`, then:

```sh
bun --no-env-file run railway:check
```

This typechecks all three definitions and runs ownership, secret-preservation, source,
and wrong-context regression checks. The root `bun run test` runs this check too.
The SDK is pinned to 3.13.1; CI uses Railway CLI 5.63.4. There is only one SDK
dependency; both test suites use the existing root package.

## Preview against the existing infrastructure

Run from the repository root. Linking changes only the CLI's local context, not
the infrastructure. Both definitions require the existing project/environment IDs
in `constants/targets.ts` and reject conflicting names when provided. IDs route
CLI requests; service names, not embedded service IDs, identify the IaC resources.

```sh
railway link --workspace Notra --project notra-demo --environment production
railway config plan --file .railway/demo.ts --detailed-exit-code

railway link --workspace Notra --project notra-prod --environment production
railway config partials list
railway config plan --file .railway/ai-traffic.ts --detailed-exit-code
```

Always pass `--file`; there is deliberately no default `.railway/railway.ts`
because these definitions target different projects. Exit code `0` means no
changes, `2` means drift, and other non-zero codes mean errors. An initial import
must produce **zero additions, changes, and deletions**. Stop if the plan proposes
replacing a service, changing variables, removing a repository, restoring a branch,
or touching observability resources.

For a read-only snapshot when updating a definition, link to the correct project
and run `railway config pull --json`. Keep only intended resources and retain
the ownership boundary. Avoid a plain `config pull` here: it generates a default
whole-project file. Do not use `--include-variables`, `--decrypt-variables`, or
`--show-values` in normal imports or plans.

## Read-only CI

`Railway infrastructure` runs credential-free checks on PRs, main changes, and
manual runs. Secret-bearing live plans run only from reviewed `main` revisions,
on pushes or manual runs targeting `main`. All PRs get offline checks only;
preview PR changes locally with the commands above before merging. The existing
GitHub `RAILWAY_TOKEN` workspace
secret is passed as `RAILWAY_API_TOKEN` to the CLI. It must not use `railway link`
in CI: workspace-scoped credentials cannot do that command's account discovery.
Instead the matrix sets `RAILWAY_PROJECT_ID` and `RAILWAY_ENVIRONMENT_ID` to the
existing targets. The guard accepts their IDs even if the CLI supplies null names.

Pending changes are printed with default value redaction, not applied. CI creates
no plan artifacts and does not provision tokens or deployments. Nothing applies
automatically after merging a PR.

## Adoption is a separate, explicitly approved step

These changes have not claimed ownership of the ingest service remotely. After
explicit approval, link the intended project and save a fresh plan from the
committed checkout:

```sh
mkdir -p .railway-plans
railway link --workspace Notra --project notra-prod --environment production
railway config plan --file .railway/ai-traffic.ts --out .railway-plans/ai-traffic.json
# Review the exact plan before executing the next command.
railway config apply --file .railway/ai-traffic.ts --plan .railway-plans/ai-traffic.json
```

Repeat for demo with `notra-demo`, `.railway/demo.ts`, and a separate plan file.
Saved plans pin local files and remote configuration; re-plan if either changes.
Plan files may contain secrets: `.railway-plans/` is git-ignored and excluded from
Docker contexts. Never upload these artifacts or auto-confirm destructive changes.

The first ingest apply records `ai-traffic` ownership even with no config changes.
Verify `railway config partials list` then shows only `service.ai-traffic-ingest`
under that partial, retains `observability`, and a second plan has no changes.
Confirm original service IDs and domains remain intact. Future changes can trigger
redeployments; coordinate applies with the existing production release window.

Reference: [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code).
