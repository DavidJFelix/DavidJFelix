const WORDS_PER_MINUTE = 200

/**
 * Calculate estimated reading time for content
 * @param content - The text content to analyze
 * @returns Reading time in minutes (minimum 1)
 */
export function getReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.ceil(words / WORDS_PER_MINUTE)
  return Math.max(1, minutes)
}

/**
 * Format reading time as a human-readable string
 * @param content - The text content to analyze
 * @returns Formatted string like "5 min read"
 */
export function formatReadingTime(content: string): string {
  const minutes = getReadingTime(content)
  return `${minutes} min read`
}
