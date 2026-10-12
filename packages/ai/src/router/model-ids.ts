import { MODEL_PRICING } from "@notra/ai/billing/token-pricing";
import {
  OPENROUTER_MODEL_ALIASES,
  OPENROUTER_UNSUPPORTED_MODELS,
  VERCEL_NAMESPACE_PREFIX,
  VERCEL_SERVED_MODEL_ALIASES,
  VERCEL_UNSUPPORTED_MODELS,
} from "@notra/ai/constants/router";
import type { GatewayId } from "@notra/ai/types/router";

export function stripVercelNamespace(modelId: string): string {
  return modelId.startsWith(VERCEL_NAMESPACE_PREFIX)
    ? modelId.slice(VERCEL_NAMESPACE_PREFIX.length)
    : modelId;
}

export function toOpenRouterModelId(modelId: string): string {
  const neutral = stripVercelNamespace(modelId);
  return OPENROUTER_MODEL_ALIASES[neutral] ?? neutral;
}

// Snapshot suffix OpenRouter may append, e.g. "-20260115" or "-2026-01-15".
const SNAPSHOT_SUFFIX_REGEX = /-\d{4}-?\d{2}-?\d{2}$/;

/**
 * Inverse of {@link toOpenRouterModelId}, for model ids OpenRouter reports
 * back. Drops a dated snapshot suffix so the id matches our pricing table.
 */
export function fromOpenRouterModelId(modelId: string): string {
  const base = modelId.replace(SNAPSHOT_SUFFIX_REGEX, "");
  for (const [neutral, alias] of Object.entries(OPENROUTER_MODEL_ALIASES)) {
    if (alias === base) {
      return neutral;
    }
  }
  return base;
}

export function toVercelModelId(modelId: string): string {
  return modelId;
}

export function fromVercelServedModelId(modelId: string): string {
  const neutral = stripVercelNamespace(modelId);
  const model = fromOpenRouterModelId(neutral);
  if (Object.hasOwn(VERCEL_SERVED_MODEL_ALIASES, model)) {
    return VERCEL_SERVED_MODEL_ALIASES[model] ?? neutral;
  }
  return Object.hasOwn(OPENROUTER_MODEL_ALIASES, model) ||
    Object.hasOwn(MODEL_PRICING, model) ||
    Object.hasOwn(MODEL_PRICING, `vercel/${model}`)
    ? model
    : neutral;
}

export function isModelSupported(gateway: GatewayId, modelId: string): boolean {
  const neutral = stripVercelNamespace(modelId);
  if (gateway === "vercel") {
    return !VERCEL_UNSUPPORTED_MODELS.has(neutral);
  }
  return !OPENROUTER_UNSUPPORTED_MODELS.has(neutral);
}

export function mapModelId(gateway: GatewayId, modelId: string): string {
  return gateway === "vercel"
    ? toVercelModelId(modelId)
    : toOpenRouterModelId(modelId);
}
