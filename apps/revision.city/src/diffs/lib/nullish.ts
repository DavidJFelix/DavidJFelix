// Strict-equality replacement for the `x == null` idiom the upstream diffshub
// code used throughout: true for exactly null and undefined. Keeps loose null
// checks readable under the repo's eqeqeq rule while preserving narrowing.
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}
