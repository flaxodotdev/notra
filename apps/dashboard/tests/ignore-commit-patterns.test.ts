import { describe, expect, test } from "bun:test";

import type { GithubProcessedEvent } from "../src/types/webhooks/webhooks";
import {
  formatIgnoreCommitPatterns,
  parseIgnoreCommitPatternsText,
} from "../src/utils/event-trigger-form";
import {
  compileIgnoreCommitPatterns,
  IGNORE_COMMIT_PATTERNS_PLACEHOLDER,
  isCommitMessageIgnored,
  isPushEventIgnoredByPatterns,
} from "../src/utils/ignore-commit-patterns";

function pushEvent(messages: unknown[]): GithubProcessedEvent {
  return {
    type: "push",
    action: "pushed",
    data: {
      commits: messages.map((message, index) => ({
        id: `sha-${index}`,
        message,
      })),
    },
  };
}

describe("compileIgnoreCommitPatterns", () => {
  test("compiles valid patterns and skips invalid ones", () => {
    const compiled = compileIgnoreCommitPatterns([
      IGNORE_COMMIT_PATTERNS_PLACEHOLDER,
      "(unclosed",
      42,
      "  ",
    ]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0]?.test("chore: bump deps")).toBe(true);
  });

  test("returns empty for non-array input", () => {
    expect(compileIgnoreCommitPatterns(undefined)).toEqual([]);
    expect(compileIgnoreCommitPatterns("^chore")).toEqual([]);
  });

  test("trims and dedupes patterns", () => {
    const compiled = compileIgnoreCommitPatterns([
      "^chore",
      "  ^chore  ",
      "^fix",
    ]);
    expect(compiled).toHaveLength(2);
  });
});

describe("isCommitMessageIgnored", () => {
  const patterns = compileIgnoreCommitPatterns([
    IGNORE_COMMIT_PATTERNS_PLACEHOLDER,
  ]);

  test("ignores chore-style commit messages", () => {
    expect(isCommitMessageIgnored("chore: bump deps", patterns)).toBe(true);
    expect(isCommitMessageIgnored("chore(): rebuild", patterns)).toBe(true);
    expect(isCommitMessageIgnored("chore(deps): update", patterns)).toBe(true);
  });

  test("keeps feature commits", () => {
    expect(isCommitMessageIgnored("feat: add login", patterns)).toBe(false);
    expect(isCommitMessageIgnored("fix: crash on load", patterns)).toBe(false);
  });

  test("never ignores without patterns or message", () => {
    expect(isCommitMessageIgnored("chore: bump", [])).toBe(false);
    expect(isCommitMessageIgnored(undefined, patterns)).toBe(false);
  });
});

describe("isPushEventIgnoredByPatterns", () => {
  const patterns = [IGNORE_COMMIT_PATTERNS_PLACEHOLDER];

  test("ignores pushes where every commit matches", () => {
    expect(
      isPushEventIgnoredByPatterns(
        pushEvent(["chore: bump deps", "chore(ci): tweak"]),
        patterns
      )
    ).toBe(true);
  });

  test("keeps pushes with at least one real change", () => {
    expect(
      isPushEventIgnoredByPatterns(
        pushEvent(["chore: bump deps", "feat: add login"]),
        patterns
      )
    ).toBe(false);
  });

  test("never ignores non-push events, empty commits, or missing patterns", () => {
    expect(
      isPushEventIgnoredByPatterns(
        { type: "release", action: "published", data: {} },
        patterns
      )
    ).toBe(false);
    expect(isPushEventIgnoredByPatterns(pushEvent([]), patterns)).toBe(false);
    expect(isPushEventIgnoredByPatterns(pushEvent(["chore: bump"]), [])).toBe(
      false
    );
    expect(
      isPushEventIgnoredByPatterns(pushEvent(["chore: bump"]), ["(unclosed"])
    ).toBe(false);
  });
});

describe("parseIgnoreCommitPatternsText", () => {
  test("parses one pattern per line, trimming and deduping", () => {
    expect(
      parseIgnoreCommitPatternsText("^chore(\\(|:)\n\n  ^chore(\\(|:)  \n^wip")
    ).toEqual(["^chore(\\(|:)", "^wip"]);
  });

  test("drops invalid regexes and returns empty for blank input", () => {
    expect(parseIgnoreCommitPatternsText("(unclosed\n^fix")).toEqual(["^fix"]);
    expect(parseIgnoreCommitPatternsText("")).toEqual([]);
    expect(parseIgnoreCommitPatternsText(undefined)).toEqual([]);
  });

  test("round-trips through formatIgnoreCommitPatterns", () => {
    const patterns = ["^chore(\\(|:)", "^wip:"];
    expect(
      parseIgnoreCommitPatternsText(formatIgnoreCommitPatterns(patterns))
    ).toEqual(patterns);
    expect(formatIgnoreCommitPatterns(undefined)).toBe("");
  });
});
