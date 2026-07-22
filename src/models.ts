import {
  FALLBACK_MODELS,
  MAX_ONLY_VARIANTS,
  POOLSIDE_BASE_URL,
  REASONING_VARIANTS,
} from "./constants.ts";
import type {
  OpenCodeModelConfig,
  OpenCodeProviderConfig,
  PoolsideApiModel,
  PoolsideModelsResponse,
} from "./types.ts";
import {
  displayName,
  isMaxOnlyModel,
  isNonChatModel,
  nonNegativeNumber,
  poolsideDisplayName,
  positiveNumber,
  strings,
} from "./utils.ts";

/**
 * Resolve a display name for a model.
 *
 * Uses the API-provided name when it is a non-empty string that differs
 * from the raw model ID. Otherwise falls back to a formatted name.
 */
function resolveModelName(id: string, apiName: unknown): string {
  if (typeof apiName === "string" && apiName && apiName !== id) {
    return apiName;
  }
  return poolsideDisplayName(id);
}

/**
 * Convert the rich Poolside `/models` response into OpenCode model configs.
 *
 * Each raw API entry is mapped to an OpenCode model config with id, name,
 * reasoning support, tool-call support, cost, limits, and reasoning
 * variants. Models that are not chat-capable (embeddings, image, etc.)
 * are filtered out.
 */
export function parseModelsResponse(
  payload: PoolsideModelsResponse
): OpenCodeModelConfig[] {
  if (!Array.isArray(payload.data)) return [];

  const known = new Map(FALLBACK_MODELS.map((item) => [item.id, item]));
  return payload.data.flatMap((raw): OpenCodeModelConfig[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as PoolsideApiModel;
    if (typeof item.id !== "string" || item.id.length === 0) return [];

    // Skip non-chat models (embeddings, image, video, etc.).
    if (isNonChatModel(item.id)) return [];

    const fallback = known.get(item.id);
    const features = strings(item.supported_features);
    const modalities = strings(item.input_modalities);
    const reasoning = Array.isArray(item.supported_features)
      ? features.includes("reasoning")
      : (fallback?.reasoning ?? true);
    const toolCall = Array.isArray(item.supported_features)
      ? features.includes("tools")
      : (fallback?.tool_call ?? true);

    const input = (["text", "image"] as const).filter((kind) =>
      modalities.includes(kind)
    );
    const pricing = item.pricing;

    const variants = reasoning
      ? isMaxOnlyModel(item.id)
        ? MAX_ONLY_VARIANTS
        : REASONING_VARIANTS
      : undefined;

    return [
      {
        id: item.id,
        name: resolveModelName(item.id, item.name),
        reasoning,
        tool_call: toolCall,
        cost: {
          input: nonNegativeNumber(pricing?.prompt, fallback?.cost.input ?? 0),
          output: nonNegativeNumber(pricing?.completion, fallback?.cost.output ?? 0),
          cache_read: nonNegativeNumber(
            pricing?.input_cache_read,
            fallback?.cost.cache_read ?? 0
          ),
          cache_write: nonNegativeNumber(
            pricing?.input_cache_read,
            fallback?.cost.cache_write ?? 0
          ),
        },
        limit: {
          context: positiveNumber(
            item.context_length,
            fallback?.limit.context ?? 262_144
          ),
          output: positiveNumber(
            item.max_completion_tokens,
            fallback?.limit.output ?? 32_768
          ),
        },
        variants,
        modalities: {
          input: input.length ? [...input] : ["text"],
          output: ["text"],
        },
      },
    ];
  });
}

/**
 * Fetch the live model catalog from the Poolside API.
 *
 * @param apiKey - Poolside API key (Bearer token).
 * @param signal - Optional abort signal for cancellation.
 * @returns Parsed model configs.
 * @throws When the API returns an error or no models.
 */
export async function fetchModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<OpenCodeModelConfig[]> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`${POOLSIDE_BASE_URL}/models`, {
    headers: {
      Accept: "application/json, application/problem+json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`Poolside /models returned HTTP ${response.status}`);
  }

  const models = parseModelsResponse(
    (await response.json()) as PoolsideModelsResponse
  );
  if (!models.length) {
    throw new Error("Poolside /models returned no models");
  }
  return models;
}

/**
 * Convert an array of model configs into the OpenCode provider `models` map.
 *
 * The map key is the model ID (e.g. `poolside/laguna-m.1`).
 */
export function modelsToConfigMap(
  models: OpenCodeModelConfig[]
): Record<string, OpenCodeModelConfig> {
  const map: Record<string, OpenCodeModelConfig> = {};
  for (const model of models) {
    map[model.id] = model;
  }
  return map;
}

/**
 * Ensure the provider config block exists and is properly initialized.
 *
 * Creates the provider entry with the correct npm package, name, env, and
 * baseURL if they are not already set. Does not overwrite existing values.
 */
export function ensureProviderConfig(
  config: Record<string, unknown>,
  providerId: string
): OpenCodeProviderConfig {
  if (!config || typeof config !== "object") {
    return {};
  }

  if (!config.provider || typeof config.provider !== "object") {
    config.provider = {};
  }

  const providers = config.provider as Record<string, unknown>;
  if (!providers[providerId] || typeof providers[providerId] !== "object") {
    providers[providerId] = {};
  }

  return providers[providerId] as OpenCodeProviderConfig;
}

/**
 * Apply the fallback model catalog to a provider config, preserving any
 * existing models that the user has already configured.
 */
export function applyFallbackModels(
  providerConfig: OpenCodeProviderConfig
): void {
  const existing = providerConfig.models ?? {};
  const fallback = modelsToConfigMap(FALLBACK_MODELS);
  providerConfig.models = { ...fallback, ...existing };
}

export { displayName, poolsideDisplayName };
