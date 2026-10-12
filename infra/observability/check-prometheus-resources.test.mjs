import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { checkPrometheusResources } from "./check-prometheus-resources.mjs";
import {
  fixtureCounts,
  windowFixtureDimensions,
} from "./constants/prometheus-fixtures.mjs";

test("Prometheus resource failure keeps listeners loopback, mounts fixture-only inputs and cleans exact run names", async () => {
  const calls = [];
  await assert.rejects(
    checkPrometheusResources(
      (_binary, args, options) => {
        assert.ok(options.timeout > 0 && options.timeout <= 120_000);
        calls.push(args);
        if (args[0] === "run" && args.includes("fixture-exporter")) {
          const mount = args.find((arg) =>
            arg.endsWith("target=/fixtures,readonly")
          );
          const directory = mount.match(/source=([^,]+)/)[1];
          assert.equal(statSync(directory).mode & 0o777, 0o755);
          for (const file of ["state.json", "prometheus.yml"]) {
            assert.equal(
              statSync(resolve(directory, file)).mode & 0o777,
              0o644
            );
          }
        }
        return {
          status: 0,
          stdout: args[0] === "port" ? "127.0.0.1:32768\n" : "fixture",
        };
      },
      async (url, options) => {
        assert.equal(url.origin, "http://127.0.0.1:32768");
        assert.equal(options.redirect, "error");
        assert.ok(options.signal instanceof AbortSignal);
        return new Response("ready");
      }
    ),
    /65534/
  );
  const run = calls.find(
    (args) => args[0] === "run" && args.includes("--publish")
  );
  const name = run[run.indexOf("--name") + 1];
  assert.match(name, /^notra-prometheus-resources-[a-f0-9-]{36}-normal$/);
  const prefix = name.replace(/-normal$/, "");
  assert.equal(run[run.indexOf("--publish") + 1], "127.0.0.1::9090");
  assert.match(
    run[run.indexOf("--mount") + 1],
    /\.artifacts\/prometheus-fixtures-[\w-]+\/prometheus.yml,target=\/etc\/prometheus\/prometheus.yml,readonly$/
  );
  assert.ok(
    run.includes("--memory=1g") &&
      run.includes("--memory-swap=1g") &&
      run.includes("--cpus=2")
  );
  assert.ok(
    !run.includes("--env") &&
      !run.includes("--env-file") &&
      !run.includes("--volume")
  );
  const exporter = calls.find(
    (args) => args[0] === "run" && !args.includes("--publish")
  );
  assert.ok(
    exporter.includes("--read-only") && exporter.includes("--cap-drop=ALL")
  );
  assert.deepEqual(calls.slice(-5), [
    ["rm", "--force", `${prefix}-exporter`],
    ["rm", "--force", `${prefix}-normal`],
    ["rm", "--force", `${prefix}-reject`],
    ["network", "rm", `${prefix}-network`],
    ["image", "rm", prefix],
  ]);
});

test("fixture permissions survive restrictive umask and every atomic state replacement", async () => {
  const previous = process.umask(0o077);
  const modes = [];
  let directory;
  let tiny = false;
  let scrape = 1;
  const labels = Object.fromEntries(
    Object.entries(windowFixtureDimensions).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ])
  );
  Object.assign(labels, {
    job: "fixture",
    instance: "fixture",
    aggregation: "fixture",
    metric: "fixture",
    unit: "fixture",
  });
  try {
    await checkPrometheusResources(
      (_binary, args) => {
        if (args[0] === "run" && args.includes("fixture-exporter")) {
          directory = args
            .find((arg) => arg.endsWith("target=/fixtures,readonly"))
            .match(/source=([^,]+)/)[1];
          assert.equal(statSync(directory).mode & 0o777, 0o755);
          assert.equal(
            statSync(resolve(directory, "prometheus.yml")).mode & 0o777,
            0o644
          );
        }
        if (args[0] === "run" && args.includes("--query.max-samples=10")) {
          tiny = true;
        }
        let stdout = "1\noom 0\noom_kill 0\n";
        if (args[0] === "port") {
          stdout = "127.0.0.1:32768\n";
        } else if (args.includes("/proc/1/status")) {
          stdout = "Uid:\t65534\t65534\t65534\t65534\n";
        }
        return { status: 0, stdout };
      },
      async (url) => {
        assert.equal(
          statSync(resolve(directory, "state.json")).mode & 0o777,
          0o644
        );
        assert.equal(existsSync(resolve(directory, "state.tmp")), false);
        const { mode } = JSON.parse(
          readFileSync(resolve(directory, "state.json"), "utf8")
        );
        if (modes.at(-1) !== mode) {
          modes.push(mode);
        }
        const success = (data) => Response.json({ status: "success", data });
        if (url.pathname === "/api/v1/status/flags") {
          return success({
            "query.max-concurrency": "4",
            "query.max-samples": tiny ? "10" : "5000000",
          });
        }
        if (url.pathname === "/api/v1/targets") {
          return success({
            activeTargets: Object.keys(fixtureCounts).map((job) => ({
              labels: { job },
              health: job === "http-probes" && mode !== "valid" ? "down" : "up",
              lastScrape: new Date(scrape++).toISOString(),
              lastScrapeDuration: 0.001,
              lastError: `${mode} label name value length body sample limit`,
            })),
          });
        }
        if (url.pathname === "/api/v1/query") {
          const query = url.searchParams.get("query");
          if (tiny && query === "sum(notra_fixture_prometheus)") {
            return Response.json(
              { status: "error", error: "too many samples" },
              { status: 422 }
            );
          }
          const job = query.match(/job="([^"]+)"/)?.[1];
          let value = 1;
          if (query.startsWith("scrape_samples_post_metric_relabeling")) {
            value = fixtureCounts[job];
          } else if (query.startsWith("count(")) {
            value = Object.values(fixtureCounts).reduce(
              (sum, count) => sum + count,
              35
            );
          } else if (query.startsWith("notra_vercel_metric_window{")) {
            value = 230;
          } else if (job === "http-probes" && mode !== "valid") {
            value = 0;
          }
          return success({
            resultType: "vector",
            result: [{ metric: labels, value: [1, String(value)] }],
          });
        }
        return new Response("ready");
      }
    );
    assert.deepEqual(modes, [
      "valid",
      "sample",
      "valid",
      "body",
      "valid",
      "labels",
      "valid",
      "name",
      "valid",
      "value",
      "valid",
    ]);
    assert.equal(existsSync(directory), false);
  } finally {
    process.umask(previous);
  }
});
