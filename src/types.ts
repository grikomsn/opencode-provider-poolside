/**
 * Raw model entry returned by the Poolside `/v1/models` endpoint.
 *
 * Fields are typed as `unknown` because the API may omit or change them.
 */
export type PoolsideApiModel = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  context_length?: unknown;
  max_completion_tokens?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
    image?: unknown;
    request?: unknown;
    input_cache_read?: unknown;
    input_cache_write?: unknown;
  };
  supported_features?: unknown;
  supported_sampling_parameters?: unknown;
  input_modalities?: unknown;
  output_modalities?: unknown;
  is_free?: unknown;
  deprecation_date?: unknown;
};

/**
 * Top-level shape of the `/v1/models` response.
 */
export type PoolsideModelsResponse = {
  data?: unknown;
  object?: string;
};

/**
 * A single model config entry injected into the OpenCode provider config.
 */
export type OpenCodeModelConfig = {
  id: string;
  name: string;
  reasoning?: boolean;
  tool_call?: boolean;
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  limit?: {
    context: number;
    output: number;
  };
  variants?: Record<string, Record<string, unknown>>;
  modalities?: {
    input: string[];
    output: string[];
  };
};

/**
 * Provider-level config entry in OpenCode's `provider` object.
 */
export type OpenCodeProviderConfig = {
  npm?: string;
  name?: string;
  env?: string[];
  options?: Record<string, unknown>;
  models?: Record<string, OpenCodeModelConfig>;
};
