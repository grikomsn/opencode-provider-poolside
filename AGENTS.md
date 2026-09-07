# AGENTS.md - Poolside OpenCode Provider

## Commands

```bash
npm run check      # typecheck && test
npm run typecheck  # tsc --noEmit
npm test           # node --experimental-strip-types --test test/*.test.ts
npm run package    # npm pack --dry-run (verify bundle)
```

## Verification order

CI runs: `npm run check` then `npm run package`. Always run both.

## Node version

Requires Node >= 22.0.0 (test matrix uses 22, 24, 26).

## Architecture

- **Main entry**: `plugin.ts` - registered as `export { default } from "."`
- **Library entry**: `index.ts` - re-exports constants, models, utils, types
- **Source**: `src/constants.ts`, `src/models.ts`, `src/types.ts`, `src/utils.ts`
- **Peer dependency**: `@ai-sdk/openai-compatible` (optional)

## Version management

Uses changesets. Run `npm run changeset` to create a changeset file.

## Test quirks

- Tests use Node's built-in test runner (not Jest/Mocha)
- Mock `globalThis.fetch` in tests to simulate API discovery
- Use `plugin.test.ts` as reference for auth hook testing pattern

## Poolside specifics

- Base URL is `https://inference.poolside.ai/v1`; models endpoint is `GET /models`.
- API keys are project-scoped Bearer tokens.
- `poolside/*` IDs are Poolside-hosted Laguna models (currently zero-cost);
  unprefixed IDs are BYOK routes. Never drop or rewrite either form —
  OpenCode sends the config entry's `id` upstream verbatim.
- The live `/models` response is authoritative for discovered models. The
  static `FALLBACK_MODELS` catalog mirrors verified context/output limits
  and only fills in missing fields — never guess prices.
- Reasoning uses OpenRouter-style `reasoning: { effort }` objects (not
  `reasoning_effort` strings). Only expose variants listed in
  `REASONING_VARIANTS` / `MAX_ONLY_VARIANTS`.