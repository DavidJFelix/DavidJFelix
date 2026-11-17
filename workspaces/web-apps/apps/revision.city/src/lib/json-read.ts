export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readUnknownPath(data: unknown, path: readonly string[]): unknown {
  let current = data
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[key]
  }
  return current
}

export function readStringPath(data: unknown, path: readonly string[]): string | undefined {
  const value = readUnknownPath(data, path)
  return typeof value === 'string' ? value : undefined
}
