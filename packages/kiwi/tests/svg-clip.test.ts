import { describe, expect, test } from "bun:test";

import {
  applyAffine,
  clipLocalMatrix,
  multiplyAffine,
  normalizeBlendMode,
  parseClipRef,
  parseCssFilter,
  parseDropShadowArgs,
  parseOpacityValue,
  parseSvgTransformAttr,
  rectClipBounds,
  subpathBounds,
} from "../src/utils/svg-clip";

describe("svg clip helpers (#386)", () => {
  test("clip refs resolve url(#id) and reject none", () => {
    expect(parseClipRef("url(#logo-clip)")).toBe("logo-clip");
    expect(parseClipRef('url("#badge-clip")')).toBe("badge-clip");
    expect(parseClipRef("url( #a )")).toBe("a");
    expect(parseClipRef("none")).toBeNull();
    expect(parseClipRef(null)).toBeNull();
    expect(parseClipRef("inset(10px)")).toBeNull();
  });

  test("blend modes map when Figma agrees, else NORMAL", () => {
    expect(normalizeBlendMode("multiply")).toBe("MULTIPLY");
    expect(normalizeBlendMode("SCREEN")).toBe("SCREEN");
    expect(normalizeBlendMode("plus-lighter")).toBe("LINEAR_DODGE");
    expect(normalizeBlendMode("no-such-mode")).toBe("NORMAL");
    expect(normalizeBlendMode(null)).toBe("NORMAL");
  });

  test("opacity parses and clamps", () => {
    expect(parseOpacityValue("0.5")).toBeCloseTo(0.5, 6);
    expect(parseOpacityValue("2")).toBe(1);
    expect(parseOpacityValue("-1")).toBe(0);
    expect(parseOpacityValue("abc")).toBeUndefined();
    expect(parseOpacityValue(null)).toBeUndefined();
  });

  test("rect clips detected, path clips rejected", () => {
    const rect = rectClipBounds([
      {
        closed: true,
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    ]);
    expect(rect).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 10 });

    expect(
      rectClipBounds([
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ])
    ).toBeNull();
    expect(
      rectClipBounds([
        { closed: true, points: [{ x: 0, y: 0 }] },
        { closed: true, points: [{ x: 1, y: 1 }] },
      ])
    ).toBeNull();
    expect(
      subpathBounds([
        {
          closed: false,
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
        },
      ])
    ).toEqual({ minX: 1, minY: 2, maxX: 3, maxY: 4 });
    expect(subpathBounds([])).toBeNull();
  });

  test("css filters keep drop-shadow and blur, drop the rest", () => {
    const shadow = parseDropShadowArgs("2px 4px 8px rgba(0, 0, 0, 0.5)");
    expect(shadow?.dx).toBe(2);
    expect(shadow?.dy).toBe(4);
    expect(shadow?.blur).toBe(8);

    const parsed = parseCssFilter(
      "drop-shadow(2px 4px 8px black) blur(5px) grayscale(1)"
    );
    expect(parsed.dropShadows).toHaveLength(1);
    expect(parsed.blur).toBe(5);
    expect(parseCssFilter("none").dropShadows).toHaveLength(0);
    expect(parseCssFilter(null).blur).toBeNull();
  });

  test("css filters keep drop-shadow with functional colors", () => {
    for (const color of [
      "rgba(0,0,0,0.5)",
      "rgba(0, 0, 0, 0.5)",
      "rgb(0 0 0 / 0.5)",
      "hsl(0 0% 0% / 50%)",
    ]) {
      const parsed = parseCssFilter(`drop-shadow(2px 4px 8px ${color})`);
      expect(parsed.dropShadows).toHaveLength(1);
      expect(parsed.dropShadows[0]?.dx).toBe(2);
      expect(parsed.dropShadows[0]?.color).toContain(color.slice(0, 3));
    }
    const multi = parseCssFilter(
      "drop-shadow(1px 2px 3px rgba(0,0,0,0.5)) drop-shadow(0 0 4px rgb(255, 0, 0)) blur(2px)"
    );
    expect(multi.dropShadows).toHaveLength(2);
    expect(multi.blur).toBe(2);
  });

  test("bounds skip non-finite points", () => {
    expect(
      subpathBounds([
        {
          closed: false,
          points: [
            { x: Number.NaN, y: 0 },
            { x: Number.POSITIVE_INFINITY, y: 0 },
          ],
        },
      ])
    ).toBeNull();
  });

  test("svg transform attrs compose into screen points", () => {
    const t = parseSvgTransformAttr("translate(10 20) scale(2)");
    expect(t.e).toBeCloseTo(10, 6);
    expect(t.a).toBeCloseTo(2, 6);
    // translate then scale: p=(1,1) -> scale -> (2,2) -> translate -> (12,22)
    expect(applyAffine(t, { x: 1, y: 1 })).toEqual({ x: 12, y: 22 });

    const r = parseSvgTransformAttr("rotate(90)");
    const p = applyAffine(r, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);

    expect(parseSvgTransformAttr(null)).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
    expect(parseSvgTransformAttr("bogus(1 2)").e).toBe(0);

    const m = multiplyAffine(
      parseSvgTransformAttr("translate(5 0)"),
      parseSvgTransformAttr("scale(3)")
    );
    expect(applyAffine(m, { x: 1, y: 1 })).toEqual({ x: 8, y: 3 });
  });

  test("clipLocalMatrix keeps or drops the container transform on request", () => {
    const node = (transform: string, parent: Element | null = null) =>
      ({
        getAttribute: (name: string) =>
          name === "transform" ? transform : null,
        parentElement: parent,
      }) as unknown as Element;

    // <svg transform="translate(100 0)"><g transform="translate(0 10)"><rect/>
    const svg = node("translate(100 0)");
    const group = node("translate(0 10)", svg);
    const rect = node("", group);

    // Container included: svg(100,0) * g(0,10).
    expect(applyAffine(clipLocalMatrix(rect, svg), { x: 0, y: 0 })).toEqual({
      x: 100,
      y: 10,
    });

    // Excluded: only the intermediate g transform remains, because the root
    // CTM already carries the svg transform.
    expect(
      applyAffine(clipLocalMatrix(rect, svg, false), { x: 0, y: 0 })
    ).toEqual({ x: 0, y: 10 });
    expect(
      applyAffine(clipLocalMatrix(group, svg, false), { x: 0, y: 0 })
    ).toEqual({ x: 0, y: 10 });
  });

  test("fixtures demonstrate clipped logos and masked fills", async () => {
    const clipped = await Bun.file(
      `${import.meta.dir}/fixtures/clipped-logo.svg`
    ).text();
    expect(clipped).toContain("<clipPath");
    expect(clipped).toContain('clip-path="url(#logo-clip)"');
    expect(clipped).toContain('clip-path="url(#badge-clip)"');

    const masked = await Bun.file(
      `${import.meta.dir}/fixtures/masked-fill.svg`
    ).text();
    expect(masked).toContain("<mask");
    expect(masked).toContain('mask="url(#fade-mask)"');
    expect(masked).toContain("<feDropShadow");
    expect(parseClipRef('mask="url(#x)"'.split("=")[1] ?? "")).toBe("x");
  });
});
