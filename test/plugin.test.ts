import { test, before, after, beforeEach } from "node:test";
import { describe } from "node:test";
import assert from "node:assert/strict";

type PluginResult = {
  config: (config: Record<string, unknown>) => Promise<void>;
  auth: {
    provider: string;
    methods: Array<{
      type: string;
      label: string;
      authorize: (
        inputs: Record<string, unknown> | undefined
      ) => Promise<{ type: string; key?: string }>;
    }>;
    loader: (
      getAuth: () => Promise<{ type: string; key?: string } | null>
    ) => Promise<Record<string, unknown>>;
  };
};

type PluginModule = { default: () => Promise<PluginResult> };

let pluginFn: PluginModule["default"];

// Capture the original fetch so we can restore it.
const originalFetch = globalThis.fetch;

// Mock fetch for model discovery.
let mockFetchCalls: { url: string; options: RequestInit }[] = [];
let mockFetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> } | null = null;

function setMockFetchResponse(
  response: { ok: boolean; status: number; json: () => Promise<unknown> } | null
) {
  mockFetchResponse = response;
}

before(async () => {
  const mod = await import("../plugin.ts");
  pluginFn = mod.default;
});

beforeEach(() => {
  mockFetchCalls = [];
  mockFetchResponse = null;
  globalThis.fetch = ((
    input: RequestInfo | URL,
    options?: RequestInit
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    mockFetchCalls.push({ url, options: options ?? {} });

    if (mockFetchResponse) {
      return Promise.resolve({
        ok: mockFetchResponse.ok,
        status: mockFetchResponse.status,
        json: mockFetchResponse.json,
      } as Response);
    }

    // Default: return empty models.
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    } as Response);
  }) as typeof globalThis.fetch;
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe("Poolside OpenCode Plugin", () => {
  test("plugin returns correct provider name", async () => {
    const plugin = await pluginFn();
    assert.equal(plugin.auth.provider, "poolside");
  });

  test("authorize returns success with valid key", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.methods[0].authorize({ key: "sk-valid-key" });
    assert.equal(result.type, "success");
    assert.equal(
      (result as { type: string; key: string }).key,
      "sk-valid-key"
    );
  });

  test("authorize returns failed with empty key", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.methods[0].authorize({ key: "   " });
    assert.equal(result.type, "failed");
  });

  test("authorize returns failed with undefined key", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.methods[0].authorize({ key: undefined });
    assert.equal(result.type, "failed");
  });

  test("authorize returns failed with missing inputs", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.methods[0].authorize(undefined);
    assert.equal(result.type, "failed");
  });

  test("authorize returns failed with non-string key", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.methods[0].authorize({
      key: 123 as unknown as string,
    });
    assert.equal(result.type, "failed");
  });

  test("loader returns apiKey on successful auth", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => ({
      type: "api",
      key: "sk-loaded-key",
    }));
    assert.deepEqual(result, { apiKey: "sk-loaded-key" });
  });

  test("loader returns empty object on null auth", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => null);
    assert.deepEqual(result, {});
  });

  test("loader returns empty object on wrong auth type", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => ({
      type: "oauth",
      key: "some-token",
    } as Record<string, unknown>));
    assert.deepEqual(result, {});
  });

  test("loader returns empty object when getAuth throws", async () => {
    const plugin = await pluginFn();
    const result = await plugin.auth.loader(async () => {
      throw new Error("auth failed");
    });
    assert.deepEqual(result, {});
  });

  test("config hook registers provider with npm and env", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { poolside: {} },
    };
    await plugin.config(config);

    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    assert.equal(poolside.npm, "@ai-sdk/openai-compatible");
    assert.equal(poolside.name, "Poolside");
    assert.deepEqual(poolside.env, ["POOLSIDE_API_KEY"]);
  });

  test("config hook sets baseURL in options", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { poolside: {} },
    };
    await plugin.config(config);

    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    assert.equal(
      (poolside.options as Record<string, unknown>).baseURL,
      "https://inference.poolside.ai/v1"
    );
  });

  test("config hook adds fallback models", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { poolside: {} },
    };
    await plugin.config(config);

    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    const models = poolside.models as Record<string, unknown>;
    assert.ok(models);
    assert.ok(Object.keys(models).length > 0);
    assert.ok(models["poolside/laguna-m.1"]);
    assert.ok(models["poolside/laguna-xs-2.1"]);
    assert.ok(models["poolside/laguna-s-2.1"]);
  });

  test("config hook does not overwrite existing npm field", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: { poolside: { npm: "custom-package" } },
    };
    await plugin.config(config);

    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    assert.equal(poolside.npm, "custom-package");
  });

  test("config hook does not overwrite existing models", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {
      provider: {
        poolside: { models: { "my-model": { id: "my-model" } } },
      },
    };
    await plugin.config(config);

    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    const models = poolside.models as Record<string, unknown>;
    assert.ok(models["my-model"]);
    assert.ok(models["poolside/laguna-m.1"]);
  });

  test("config hook creates provider block if missing", async () => {
    const plugin = await pluginFn();
    const config: Record<string, unknown> = {};
    await plugin.config(config);

    assert.ok(config.provider);
    const poolside = (
      config.provider as Record<string, Record<string, unknown>>
    ).poolside;
    assert.ok(poolside);
    assert.equal(poolside.npm, "@ai-sdk/openai-compatible");
  });

  test("config hook discovers live models when API key is set", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    process.env.POOLSIDE_API_KEY = "test-api-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "poolside/laguna-m.1",
              name: "Poolside: Laguna M.1",
              context_length: 262144,
              max_completion_tokens: 32768,
              pricing: { prompt: "0", completion: "0" },
              supported_features: ["tools", "reasoning"],
              input_modalities: ["text"],
            },
            {
              id: "poolside/laguna-xs-2.1",
              name: "Poolside: Laguna XS 2.1",
              context_length: 262144,
              max_completion_tokens: 32768,
              pricing: { prompt: "0", completion: "0" },
              supported_features: ["tools", "reasoning"],
              input_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { poolside: {} },
      };
      await plugin.config(config);

      assert.ok(mockFetchCalls.length > 0);
      assert.ok(
        mockFetchCalls.some((call) =>
          call.url.includes("inference.poolside.ai/v1/models")
        )
      );

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      assert.ok(models["poolside/laguna-m.1"]);
      assert.ok(models["poolside/laguna-xs-2.1"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      } else {
        delete process.env.POOLSIDE_API_KEY;
      }
    }
  });

  test("config hook keeps fallback models when API key is absent", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    delete process.env.POOLSIDE_API_KEY;

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { poolside: {} },
      };
      await plugin.config(config);

      assert.equal(mockFetchCalls.length, 0);

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      assert.ok(models["poolside/laguna-m.1"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      }
    }
  });

  test("config hook keeps fallback models when API fails", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    process.env.POOLSIDE_API_KEY = "test-api-key";

    setMockFetchResponse({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server error" }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { poolside: {} },
      };
      await plugin.config(config);

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      assert.ok(models["poolside/laguna-m.1"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      } else {
        delete process.env.POOLSIDE_API_KEY;
      }
    }
  });

  test("config hook preserves user models when discovery succeeds", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    process.env.POOLSIDE_API_KEY = "test-api-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "poolside/laguna-m.1",
              name: "Poolside: Laguna M.1",
              context_length: 262144,
              max_completion_tokens: 32768,
              pricing: { prompt: "0", completion: "0" },
              supported_features: ["tools", "reasoning"],
              input_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: {
          poolside: {
            models: { "my-custom-model": { id: "my-custom-model", name: "Custom" } },
          },
        },
      };
      await plugin.config(config);

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      assert.ok(models["my-custom-model"]);
      assert.ok(models["poolside/laguna-m.1"]);
      // Discovered model should have full metadata including modalities
      const discovered = models["poolside/laguna-m.1"] as Record<string, unknown>;
      assert.ok(discovered.modalities);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      } else {
        delete process.env.POOLSIDE_API_KEY;
      }
    }
  });

  test("config hook includes modalities in discovered models", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    process.env.POOLSIDE_API_KEY = "test-api-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "poolside/laguna-m.1",
              name: "Poolside: Laguna M.1",
              supported_features: ["tools", "reasoning"],
              input_modalities: ["text"],
              output_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { poolside: {} },
      };
      await plugin.config(config);

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      const model = models["poolside/laguna-m.1"] as Record<string, unknown>;
      assert.ok(model.modalities);
      const modalities = model.modalities as Record<string, unknown>;
      assert.deepEqual(modalities.input, ["text"]);
      assert.deepEqual(modalities.output, ["text"]);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      } else {
        delete process.env.POOLSIDE_API_KEY;
      }
    }
  });

  test("config hook uses max-only variants for Laguna S 2.1", async () => {
    const originalEnv = process.env.POOLSIDE_API_KEY;
    process.env.POOLSIDE_API_KEY = "test-api-key";

    setMockFetchResponse({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: "poolside/laguna-s-2.1",
              name: "Poolside: Laguna S 2.1",
              supported_features: ["tools", "reasoning"],
              input_modalities: ["text"],
            },
          ],
        }),
    });

    try {
      const plugin = await pluginFn();
      const config: Record<string, unknown> = {
        provider: { poolside: {} },
      };
      await plugin.config(config);

      const poolside = (
        config.provider as Record<string, Record<string, unknown>>
      ).poolside;
      const models = poolside.models as Record<string, unknown>;
      const model = models["poolside/laguna-s-2.1"] as Record<string, unknown>;
      const variants = model.variants as Record<string, unknown>;
      assert.ok(variants);
      assert.ok(variants.none);
      assert.ok(variants.xhigh);
      assert.ok(!variants.minimal);
      assert.ok(!variants.low);
      assert.ok(!variants.medium);
      assert.ok(!variants.high);
    } finally {
      if (originalEnv !== undefined) {
        process.env.POOLSIDE_API_KEY = originalEnv;
      } else {
        delete process.env.POOLSIDE_API_KEY;
      }
    }
  });
});
