/**
 * Poolside Platform API base URL.
 *
 * Poolside exposes an OpenAI-compatible API at this path. A Poolside
 * deployment serves the same API at `/openai/v1` instead.
 */
export const POOLSIDE_BASE_URL = "https://inference.poolside.ai/v1";

/**
 * Environment variable name that holds the Poolside API key.
 */
export const POOLSIDE_API_KEY_ENV = "POOLSIDE_API_KEY";

/**
 * Display name for the Poolside provider in OpenCode.
 */
export const PROVIDER_NAME = "Poolside";

/**
 * Provider ID used in OpenCode config and auth.
 */
export const PROVIDER_ID = "poolside";

/**
 * Default reasoning effort when none is specified.
 */
export const DEFAULT_REASONING_EFFORT = "high";

/**
 * Reasoning effort levels supported by Poolside's Laguna models.
 *
 * Maps Pi's thinking-level names to the wire-level effort strings that
 * the Poolside API accepts (`none`, `minimal`, `low`, `medium`, `high`,
 * `xhigh`). `max` maps to `null` because the API has no `max` level —
 * callers should use `xhigh` for the highest effort.
 */
export const STANDARD_THINKING_LEVELS = {
  off: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: null,
} as const;

/**
 * Laguna S 2.1 exposes only `off` and `max` thinking. The API calls its
 * highest wire-level effort `xhigh`, while OpenCode presents that mode as
 * `max`.
 */
export const MAX_ONLY_THINKING_LEVELS = {
  off: "none",
  minimal: null,
  low: null,
  medium: null,
  high: null,
  xhigh: null,
  max: "xhigh",
} as const;

/**
 * Reasoning effort variants injected into OpenCode model config.
 *
 * Each entry maps an OpenCode variant to the OpenRouter-style `reasoning`
 * object accepted by Poolside's OpenAI-compatible API.
 */
export const REASONING_VARIANTS = {
  none: { reasoning: { effort: "none" } },
  minimal: { reasoning: { effort: "minimal" } },
  low: { reasoning: { effort: "low" } },
  medium: { reasoning: { effort: "medium" } },
  high: { reasoning: { effort: "high" } },
  xhigh: { reasoning: { effort: "xhigh" } },
} as const;

/**
 * Variants for models that only support `off` and `max` thinking
 * (e.g. Laguna S 2.1). Only `none` and `xhigh` are exposed so the
 * OpenCode variant picker doesn't offer unsupported levels.
 */
export const MAX_ONLY_VARIANTS = {
  none: { reasoning: { effort: "none" } },
  xhigh: { reasoning: { effort: "xhigh" } },
} as const;

/**
 * Zero-cost placeholder used by the fallback model catalog.
 *
 * Poolside's hosted Laguna models are currently free, so all cost fields
 * are zero.
 */
const ZERO_COST = { input: 0, output: 0, cache_read: 0, cache_write: 0 } as const;

/**
 * Default context window and output token limits for Poolside models.
 */
const DEFAULT_CONTEXT_WINDOW = 262_144;
const DEFAULT_MAX_TOKENS = 32_768;

/**
 * Current Poolside Platform models, available before authenticated refresh.
 *
 * These mirror the live `/models` response so the provider works even when
 * the API is unreachable. The `refreshModels` config hook replaces these
 * with account-specific data at startup.
 */
export const FALLBACK_MODELS = [
  {
    id: "poolside/laguna-m.1",
    name: "Poolside: Laguna M.1",
    reasoning: true,
    tool_call: true,
    cost: ZERO_COST,
    limit: { context: DEFAULT_CONTEXT_WINDOW, output: DEFAULT_MAX_TOKENS },
    variants: REASONING_VARIANTS,
  },
  {
    id: "poolside/laguna-xs-2.1",
    name: "Poolside: Laguna XS 2.1",
    reasoning: true,
    tool_call: true,
    cost: ZERO_COST,
    limit: { context: DEFAULT_CONTEXT_WINDOW, output: DEFAULT_MAX_TOKENS },
    variants: REASONING_VARIANTS,
  },
  {
    id: "poolside/laguna-s-2.1",
    name: "Poolside: Laguna S 2.1",
    reasoning: true,
    tool_call: true,
    cost: ZERO_COST,
    limit: { context: DEFAULT_CONTEXT_WINDOW, output: DEFAULT_MAX_TOKENS },
    variants: MAX_ONLY_VARIANTS,
  },
];
