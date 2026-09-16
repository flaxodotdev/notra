export const MAX_IGNORE_COMMIT_PATTERNS = 10;
export const MAX_IGNORE_COMMIT_PATTERN_LENGTH = 120;
export const IGNORE_COMMIT_PATTERN_FLAGS = "i";

const QUANTIFIER_BRACE_PATTERN = /\{\d/;

export function isUnsafeIgnoreCommitPattern(pattern: string): boolean {
  const groupHasQuantifier: boolean[] = [];
  const groupHasAlternation: boolean[] = [];
  let escaped = false;
  let inClass = false;

  const markQuantifier = () => {
    if (groupHasQuantifier.length > 0) {
      groupHasQuantifier[groupHasQuantifier.length - 1] = true;
    }
  };

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? "";
    if (escaped && !inClass && char >= "1" && char <= "9") {
      return true;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (inClass) {
      inClass = char !== "]";
      continue;
    }
    if (char === "[") {
      inClass = true;
      continue;
    }
    if (char === "(") {
      const rest = pattern.slice(index + 1, index + 4);
      if (
        rest.startsWith("?=") ||
        rest.startsWith("?!") ||
        rest.startsWith("?<=") ||
        rest.startsWith("?<!")
      ) {
        return true;
      }
      if (pattern[index + 1] === "?") {
        index += 1;
      }
      groupHasQuantifier.push(false);
      groupHasAlternation.push(false);
      continue;
    }
    if (char === "|") {
      if (groupHasAlternation.length > 0) {
        groupHasAlternation[groupHasAlternation.length - 1] = true;
      }
      continue;
    }
    if (char === ")") {
      const hasInnerQuantifier = groupHasQuantifier.pop() ?? false;
      const hasInnerAlternation = groupHasAlternation.pop() ?? false;
      const next = pattern[index + 1];
      const isQuantified =
        next === "*" ||
        next === "+" ||
        next === "?" ||
        (next === "{" &&
          QUANTIFIER_BRACE_PATTERN.test(pattern.slice(index + 1, index + 3)));
      if (isQuantified && (hasInnerQuantifier || hasInnerAlternation)) {
        return true;
      }
      if (hasInnerQuantifier) {
        markQuantifier();
      }
      continue;
    }
    if (char === "*" || char === "+" || char === "?") {
      markQuantifier();
      continue;
    }
    if (
      char === "{" &&
      QUANTIFIER_BRACE_PATTERN.test(pattern.slice(index, index + 2))
    ) {
      markQuantifier();
    }
  }

  return false;
}

export const IGNORE_COMMIT_PATTERNS_SEPARATOR = ", ";

export function splitIgnoreCommitPatternsText(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let escaped = false;
  let inClass = false;
  let braceDepth = 0;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (inClass) {
      current += char;
      inClass = char !== "]";
      continue;
    }
    if (char === "[") {
      inClass = true;
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (char === "," && braceDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter(Boolean);
}

export function joinIgnoreCommitPatterns(patterns: string[]): string {
  return patterns.join(IGNORE_COMMIT_PATTERNS_SEPARATOR);
}

export function isValidIgnoreCommitPattern(pattern: string): boolean {
  try {
    new RegExp(pattern, IGNORE_COMMIT_PATTERN_FLAGS);
    return true;
  } catch {
    return false;
  }
}
