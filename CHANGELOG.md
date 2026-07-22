# opencode-provider-poolside

## 0.2.1

### Patch Changes

- a026e80: Fix the default plugin entry point, OpenCode API-key login, model aliases, and Poolside reasoning request options. Package metadata and release checks now keep published artifacts consistent.

## 0.2.0

### Minor Changes

- 99ad550: Initial release of the OpenCode plugin for the Poolside AI model provider.

  - Registers the `poolside` provider using `@ai-sdk/openai-compatible` with the correct base URL (`https://inference.poolside.ai/v1`)
  - Live model discovery from the Poolside API at startup, with fallback to a static Laguna model catalog
  - API key management via OpenCode's `/connect poolside` command
  - Reasoning effort variants (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`) for Laguna models
  - Max-only reasoning variants for Laguna S 2.1 (only `none` and `xhigh`)
