import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseModelsResponse, modelsToConfigMap } from "../src/models.ts";
import { FALLBACK_MODELS } from "../src/constants.ts";
import type { PoolsideModelsResponse } from "../src/types.ts";

describe("parseModelsResponse", () => {
  test("returns empty array for non-array data", () => {
    const result = parseModelsResponse({ data: "not-an-array" });
    assert.deepEqual(result, []);
  });

  test("returns empty array for missing data", () => {
    const result = parseModelsResponse({});
    assert.deepEqual(result, []);
  });

  test("parses a valid model entry", () => {
    const payload: PoolsideModelsResponse = {
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
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);

    const model = result[0]!;
    assert.equal(model.id, "poolside/laguna-m.1");
    assert.equal(model.name, "Poolside: Laguna M.1");
    assert.equal(model.reasoning, true);
    assert.equal(model.tool_call, true);
    assert.deepEqual(model.limit, { context: 262144, output: 32768 });
    assert.deepEqual(model.cost, {
      input: 0,
      output: 0,
      cache_read: 0,
      cache_write: 0,
    });
    assert.ok(model.variants);
    assert.ok(model.modalities);
    assert.deepEqual(model.modalities!.input, ["text"]);
    assert.deepEqual(model.modalities!.output, ["text"]);
  });

  test("skips non-chat models (embeddings, image, etc.)", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        { id: "poolside/laguna-m.1", supported_features: ["tools"] },
        { id: "poolside/text-embedding-3-small" },
        { id: "poolside/image-gen" },
        { id: "poolside/whisper-audio" },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "poolside/laguna-m.1");
  });

  test("skips entries without a valid id", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        { id: "" },
        { id: 123 },
        { id: null },
        { foo: "bar" },
        { id: "poolside/laguna-m.1" },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.id, "poolside/laguna-m.1");
  });

  test("skips non-object entries", () => {
    const payload: PoolsideModelsResponse = {
      data: ["string", 42, null, { id: "poolside/laguna-m.1" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);
  });

  test("uses fallback values when API fields are missing", () => {
    const payload: PoolsideModelsResponse = {
      data: [{ id: "poolside/laguna-m.1" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 1);

    const model = result[0]!;
    assert.equal(model.reasoning, true);
    assert.equal(model.tool_call, true);
    assert.equal(model.limit.context, 262144);
    assert.equal(model.limit.output, 32768);
  });

  test("parses pricing as numbers", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        {
          id: "poolside/laguna-m.1",
          pricing: {
            prompt: "0.14",
            completion: "0.28",
            input_cache_read: "0.01",
            input_cache_write: "0.02",
          },
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.cost.input, 0.14);
    assert.equal(result[0]!.cost.output, 0.28);
    assert.equal(result[0]!.cost.cache_read, 0.01);
    assert.equal(result[0]!.cost.cache_write, 0.02);
  });

  test("sets reasoning to false when not in supported_features", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        {
          id: "poolside/laguna-m.1",
          supported_features: ["tools"],
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.reasoning, false);
    assert.equal(result[0]!.variants, undefined);
  });

  test("sets tool_call to false when not in supported_features", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        {
          id: "poolside/laguna-m.1",
          supported_features: ["reasoning"],
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.tool_call, false);
  });

  test("uses API name when available", () => {
    const payload: PoolsideModelsResponse = {
      data: [{ id: "poolside/laguna-m.1", name: "Custom Name" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.name, "Custom Name");
  });

  test("falls back to display name when API name is missing", () => {
    const payload: PoolsideModelsResponse = {
      data: [{ id: "poolside/laguna-m.1" }],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result[0]!.name, "Poolside: Laguna M.1");
  });

  test("handles image input modality", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        {
          id: "poolside/laguna-m.1",
          input_modalities: ["text", "image"],
        },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.deepEqual(result[0]!.modalities!.input, ["text", "image"]);
  });

  test("parses all three fallback models", () => {
    const payload: PoolsideModelsResponse = {
      data: [
        { id: "poolside/laguna-m.1", supported_features: ["tools", "reasoning"] },
        { id: "poolside/laguna-xs-2.1", supported_features: ["tools", "reasoning"] },
        { id: "poolside/laguna-s-2.1", supported_features: ["tools", "reasoning"] },
      ],
    };
    const result = parseModelsResponse(payload);
    assert.equal(result.length, 3);
    assert.equal(result[0]!.id, "poolside/laguna-m.1");
    assert.equal(result[1]!.id, "poolside/laguna-xs-2.1");
    assert.equal(result[2]!.id, "poolside/laguna-s-2.1");
  });
});

describe("modelsToConfigMap", () => {
  test("uses unprefixed OpenCode keys while preserving upstream IDs", () => {
    const models = [
      { id: "poolside/laguna-m.1", name: "Laguna M.1" },
      { id: "poolside/laguna-xs-2.1", name: "Laguna XS 2.1" },
    ];
    const map = modelsToConfigMap(models as never);
    assert.equal(Object.keys(map).length, 2);
    assert.equal(map["laguna-m.1"].name, "Laguna M.1");
    assert.equal(map["laguna-m.1"].id, "poolside/laguna-m.1");
    assert.equal(map["laguna-xs-2.1"].name, "Laguna XS 2.1");
    assert.ok(!map["poolside/laguna-m.1"]);
  });

  test("preserves IDs that do not use the provider prefix", () => {
    const map = modelsToConfigMap([
      { id: "custom-model", name: "Custom" },
    ] as never);
    assert.equal(map["custom-model"].id, "custom-model");
  });

  test("returns empty object for empty array", () => {
    const map = modelsToConfigMap([]);
    assert.deepEqual(map, {});
  });
});

describe("FALLBACK_MODELS", () => {
  test("includes all three Laguna models", () => {
    assert.equal(FALLBACK_MODELS.length, 3);
    const ids = FALLBACK_MODELS.map((m) => m.id);
    assert.ok(ids.includes("poolside/laguna-m.1"));
    assert.ok(ids.includes("poolside/laguna-xs-2.1"));
    assert.ok(ids.includes("poolside/laguna-s-2.1"));
  });

  test("all fallback models have reasoning enabled", () => {
    for (const model of FALLBACK_MODELS) {
      assert.equal(model.reasoning, true);
    }
  });

  test("all fallback models have variants", () => {
    for (const model of FALLBACK_MODELS) {
      assert.ok(model.variants);
      assert.ok(Object.keys(model.variants).length > 0);
    }
  });
});
