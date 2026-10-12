# Demo and AI traffic infrastructure

These TypeScript definitions describe **existing** Railway services. They do not
provision a replacement stack, copy secrets, or deploy application code.

| File | Project / environment | Managed resources | Ownership |
| --- | --- | --- | --- |
| `demo.ts` | `notra-demo` / `production` | `demo-api`, `dashboard` | Whole demo environment |
| `ai-traffic.ts` | `notra-prod` / `production` | `ai-traffic-ingest` | Named partial `ai-traffic` |

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
bun run railway:check
```

This typechecks both definitions and runs ownership, secret-preservation, source,
and wrong-context regression checks. The root `bun run test` runs this check too.
The SDK is pinned to 3.12.0; CI uses Railway CLI 5.63.4. There is only one SDK
dependency and one test suite, both using the existing root package.

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
