/**
 * Parse a value into a non-negative number, falling back when invalid.
 */
export function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Parse a value into a positive number, falling back when invalid.
 */
export function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Extract an array of strings from an unknown value.
 */
export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Convert a model ID like `poolside/laguna-m.1` into a human-friendly name.
 *
 * Falls back to the raw ID when the name is not available from the API.
 */
export function displayName(id: string): string {
  return id
    .replace(/^poolside\//i, "")
    .split("-")
    .map((part) =>
      /^(xs|s|m)(?:\.|$)/i.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

/**
 * Convert a model ID into a display name prefixed with "Poolside:".
 */
export function poolsideDisplayName(id: string): string {
  return `Poolside: ${displayName(id)}`;
}

/**
 * Determine whether a model ID refers to a Poolside Laguna model that
 * only supports `off` and `max` thinking (Laguna S 2.1).
 */
export function isMaxOnlyModel(id: string): boolean {
  return id === "poolside/laguna-s-2.1";
}

/**
 * Check whether a model ID is a non-chat model (embedding, image, etc.).
 */
export function isNonChatModel(id: string): boolean {
  const value = id.toLowerCase();
  return /(?:^|[-/])(point|embed(?:ding)?s?|image|video|audio|voice)(?:[-/.]|$)/.test(value);
}
