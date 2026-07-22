---
"opencode-provider-poolside": minor
---

Initial release of the OpenCode plugin for the Poolside AI model provider.

- Registers the `poolside` provider using `@ai-sdk/openai-compatible` with the correct base URL (`https://inference.poolside.ai/v1`)
- Live model discovery from the Poolside API at startup, with fallback to a static Laguna model catalog
- API key management via OpenCode's `/connect poolside` command
- Reasoning effort variants (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`) for Laguna models
- Max-only reasoning variants for Laguna S 2.1 (only `none` and `xhigh`)
