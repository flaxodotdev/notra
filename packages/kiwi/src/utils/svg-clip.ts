import { SVG_GEOMETRY_SELECTOR } from "../constants/dom-to-scene";
import {
  CLIP_FINGERPRINT_DIGITS,
  MASK_DARK_LUMINANCE,
} from "../constants/svg-clip";
import type { SvgClip, SvgShape } from "../types/dom-to-scene";
import type {
  Affine,
  ClipChildSource,
  ClipRef,
  ClipSource,
  MaskChildTone,
  StyleGetter,
} from "../types/svg-clip";
import type { PathSubpath } from "../types/svg-path";
import { applyAffine, multiplyAffine, svgTransformBetween } from "./affine";
import { parseColor } from "./css-color";
import { parseOpacityValue, parseUrlRef } from "./css-value";
import {
  clipSubpathToRect,
  convexContours,
  normalizeChildWinding,
  subpathBounds,
  withWinding,
} from "./polygon";
import { svgPrimitiveAttrs, svgPrimitiveToSubpaths } from "./svg-primitive";

export function createStyleCache(): StyleGetter {
  const cache = new Map<Element, CSSStyleDeclaration>();
  return (el) => {
    let style = cache.get(el);
    if (!style) {
      style = getComputedStyle(el);
      cache.set(el, style);
    }
    return style;
  };
}

export function svgClipRefs(el: Element, getStyle: StyleGetter): ClipRef[] {
  const clips: ClipRef[] = [];
  const masks: ClipRef[] = [];
  for (
    let node: Element | null = el;
    node && node.tagName.toLowerCase() !== "svg";
    node = node.parentElement
  ) {
    const style = getStyle(node);
    const clipId =
      parseUrlRef(node.getAttribute("clip-path")) ??
      parseUrlRef(style.getPropertyValue("clip-path"));
    if (clipId) {
      clips.unshift({ id: clipId, ref: node });
    }
    const maskId =
      parseUrlRef(node.getAttribute("mask")) ??
      parseUrlRef(style.getPropertyValue("mask-image")) ??
      parseUrlRef(style.getPropertyValue("mask"));
    if (maskId) {
      masks.unshift({ id: maskId, ref: node });
    }
  }
  return [
    ...clips,
    ...masks.filter((mask) => !clips.some((clip) => clip.id === mask.id)),
  ];
}

function isEvenOddClipChild(
  child: Element,
  container: Element,
  getStyle: StyleGetter
): boolean {
  const style = getStyle(child);
  return [
    child.getAttribute("fill-rule"),
    child.getAttribute("clip-rule"),
    container.getAttribute("fill-rule"),
    container.getAttribute("clip-rule"),
    style.getPropertyValue("fill-rule"),
    style.getPropertyValue("clip-rule"),
  ].some((value) => value?.trim() === "evenodd");
}

function maskChildTone(child: Element, getStyle: StyleGetter): MaskChildTone {
  const style = getStyle(child);
  const fill = (
    child.getAttribute("fill") ?? style.getPropertyValue("fill")
  ).trim();
  if (fill === "none" || fill.startsWith("url(")) {
    return "skip";
  }
  const color = parseColor(fill);
  if (!color) {
    return "light";
  }
  const [r, g, b, a] = color;
  const fillOpacity =
    parseOpacityValue(child.getAttribute("fill-opacity")) ??
    parseOpacityValue(style.getPropertyValue("fill-opacity")) ??
    1;
  const opacity =
    parseOpacityValue(child.getAttribute("opacity")) ??
    parseOpacityValue(style.getPropertyValue("opacity")) ??
    1;
  if (a * fillOpacity * opacity <= 0) {
    return "skip";
  }
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < MASK_DARK_LUMINANCE ? "dark" : "light";
}

export function collectSvgClipSources(
  svg: SVGSVGElement,
  getStyle: StyleGetter
): Map<string, ClipSource> {
  const sources = new Map<string, ClipSource>();
  for (const container of svg.querySelectorAll("clipPath, mask")) {
    const id = container.getAttribute("id");
    const kind = container.tagName.toLowerCase() === "mask" ? "mask" : "clip";
    const unitsAttr = kind === "mask" ? "maskContentUnits" : "clipPathUnits";
    if (
      !id ||
      sources.has(id) ||
      container.getAttribute(unitsAttr)?.trim() === "objectBoundingBox"
    ) {
      continue;
    }
    const children: ClipChildSource[] = [];
    for (const child of container.querySelectorAll(SVG_GEOMETRY_SELECTOR)) {
      const tone = kind === "mask" ? maskChildTone(child, getStyle) : "light";
      if (tone === "skip") {
        continue;
      }
      const subs = svgPrimitiveToSubpaths(
        child.tagName.toLowerCase(),
        svgPrimitiveAttrs(child)
      );
      if (subs.length === 0) {
        continue;
      }
      children.push({
        el: child,
        subs,
        evenOdd:
          kind === "clip" && isEvenOddClipChild(child, container, getStyle),
        dark: tone === "dark",
      });
    }
    if (children.length > 0) {
      sources.set(id, { id, kind, container, children });
    }
  }
  return sources;
}

function affineFingerprint(m: Affine): string {
  return [m.a, m.b, m.c, m.d, m.e, m.f]
    .map((n) => n.toFixed(CLIP_FINGERPRINT_DIGITS))
    .join(",");
}

function mapClipChild(
  child: ClipChildSource,
  container: Element,
  root: Affine,
  ref: Affine
): PathSubpath[] {
  const total = multiplyAffine(
    root,
    multiplyAffine(ref, svgTransformBetween(child.el, container))
  );
  return child.subs.map((sub) => ({
    closed: sub.closed,
    points: sub.points.map((p) => applyAffine(total, p)),
  }));
}

function maskSubpaths(
  source: ClipSource,
  map: (child: ClipChildSource) => PathSubpath[]
): PathSubpath[] {
  const lit = convexContours(
    source.children
      .filter((child) => !child.dark)
      .flatMap((child) => normalizeChildWinding(map(child)))
  );
  const litBounds = subpathBounds(lit);
  if (!litBounds) {
    return lit;
  }
  const cuts = source.children
    .filter((child) => child.dark)
    .flatMap(map)
    .flatMap((dark) => {
      const cut = clipSubpathToRect(dark, litBounds);
      return cut ? [withWinding(cut, false)] : [];
    });
  return [...lit, ...convexContours(cuts)];
}

export function resolveClip(
  source: ClipSource,
  ref: Element,
  svg: SVGSVGElement,
  root: Affine,
  resolved: Map<string, SvgClip>
): string | null {
  const refMatrix = svgTransformBetween(ref, svg, false);
  const key = `${source.id}|${affineFingerprint(refMatrix)}`;
  if (resolved.has(key)) {
    return key;
  }
  const map = (child: ClipChildSource): PathSubpath[] =>
    mapClipChild(child, source.container, root, refMatrix);
  const subpaths =
    source.kind === "clip"
      ? source.children.flatMap((child) =>
          convexContours(normalizeChildWinding(map(child)))
        )
      : maskSubpaths(source, map);
  if (subpaths.length === 0) {
    return null;
  }
  const evenOdd = source.children.some((child) => child.evenOdd);
  resolved.set(key, {
    id: key,
    subpaths,
    fillRule: evenOdd ? "evenodd" : "nonzero",
  });
  return key;
}

function shapeRunKey(shape: SvgShape): string {
  return `${shape.clipChain.join("|")}\n${shape.effectGroup ?? ""}`;
}

export function svgShapeRuns(shapes: SvgShape[]): SvgShape[][] {
  const runs: SvgShape[][] = [];
  for (const shape of shapes) {
    const run = runs.at(-1);
    const [first] = run ?? [];
    if (run && first && shapeRunKey(first) === shapeRunKey(shape)) {
      run.push(shape);
    } else {
      runs.push([shape]);
    }
  }
  return runs;
}
