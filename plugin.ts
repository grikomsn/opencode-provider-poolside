import type { PluginInput } from "@opencode-ai/plugin";
import {
  FALLBACK_MODELS,
  POOLSIDE_API_KEY_ENV,
  POOLSIDE_BASE_URL,
  PROVIDER_ID,
  PROVIDER_NAME,
} from "./src/constants.ts";
import {
  ensureProviderConfig,
  fetchModels,
  modelsToConfigMap,
} from "./src/models.ts";
import type { OpenCodeModelConfig, OpenCodeProviderConfig } from "./src/types.ts";

/**
 * OpenCode plugin that registers the Poolside AI model provider.
 *
 * The plugin:
 * 1. Registers the `poolside` provider using `@ai-sdk/openai-compatible`
 *    with the correct base URL and environment variable.
 * 2. Discovers live models from the Poolside API at config time, falling
 *    back to a static catalog when the API is unreachable.
 * 3. Handles API key management via the auth hook.
 *
 * Usage in `opencode.json`:
 * ```json
 * {
 *   "plugin": ["opencode-provider-poolside/server"],
 *   "provider": {
 *     "poolside": {
 *       "npm": "@ai-sdk/openai-compatible",
 *       "name": "Poolside",
 *       "env": ["POOLSIDE_API_KEY"]
 *     }
 *   }
 * }
 * ```
 */
export default async function poolsidePlugin(
  _input: PluginInput
) {
  return {
    /**
     * Config hook: registers the Poolside provider and discovers models.
     *
     * Called once during OpenCode startup with the full config object.
     * The hook mutates the config in place to add or update the `poolside`
     * provider entry.
     */
    config: async (config: Record<string, unknown>): Promise<void> => {
      const providerConfig = ensureProviderConfig(config, PROVIDER_ID);

      // Set provider metadata if not already configured.
      if (!providerConfig.npm) {
        providerConfig.npm = "@ai-sdk/openai-compatible";
      }
      if (!providerConfig.name) {
        providerConfig.name = PROVIDER_NAME;
      }
      if (!providerConfig.env || !Array.isArray(providerConfig.env)) {
        providerConfig.env = [POOLSIDE_API_KEY_ENV];
      }

      // Set the OpenAI-compatible base URL.
      if (!providerConfig.options) {
        providerConfig.options = {};
      }
      if (!providerConfig.options.baseURL) {
        providerConfig.options.baseURL = POOLSIDE_BASE_URL;
      }

      // Preserve any models the user has already configured so they
      // are never overwritten by fallbacks or discovery.
      const userModels = providerConfig.models ?? {};
      const fallbackModels = modelsToConfigMap(FALLBACK_MODELS);

      // Attempt live model discovery using the API key from the environment.
      const apiKey = process.env[POOLSIDE_API_KEY_ENV];
      if (apiKey) {
        try {
          const discovered = await fetchModels(apiKey);
          const discoveredMap = modelsToConfigMap(discovered);
          // Merge: fallback first, then discovered (overwrites fallback),
          // then user models (never overwritten).
          providerConfig.models = {
            ...fallbackModels,
            ...discoveredMap,
            ...userModels,
          };
        } catch {
          // Keep the fallback catalog through transient failures.
          providerConfig.models = { ...fallbackModels, ...userModels };
        }
      } else {
        // No API key: use fallback models alongside any user models.
        providerConfig.models = { ...fallbackModels, ...userModels };
      }
    },

    /**
     * Auth hook: manages Poolside API key credentials.
     *
     * Supports the standard API key auth method. The loader returns the
     * key as `{ apiKey }` so OpenCode can inject it into the provider's
     * environment.
     */
    auth: {
      provider: PROVIDER_ID,
      methods: [
        {
          type: "api" as const,
          label: "API Key",
          authorize: async (
            inputs: Record<string, unknown> | undefined
          ): Promise<{ type: "success"; key: string } | { type: "failed" }> => {
            const rawKey = inputs?.key;
            if (typeof rawKey !== "string") return { type: "failed" };
            const key = rawKey.trim();
            if (!key) return { type: "failed" };
            return { type: "success", key };
          },
        },
      ],
      loader: async (
        getAuth: () => Promise<{ type: string; key?: string } | null>
      ): Promise<Record<string, unknown>> => {
        try {
          const auth = await getAuth();
          if (!auth) return {};
          if (auth.type === "api" && auth.key) return { apiKey: auth.key };
          return {};
        } catch {
          return {};
        }
      },
    },
  };
}
