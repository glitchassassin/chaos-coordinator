/**
 * Format a duration in milliseconds to a human-readable string.
 * Examples: "< 1h", "4h", "2d", "3w"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (weeks > 0) return `${weeks.toString()}w`
  if (days > 0) return `${days.toString()}d`
  if (hours > 0) return `${hours.toString()}h`
  return '< 1h'
}

/**
 * Calculate time elapsed since a given timestamp.
 * Returns formatted duration string (e.g., "2d", "4h").
 */
export function timeElapsed(timestamp: string): string {
  const elapsed = Date.now() - new Date(timestamp).getTime()
  return formatDuration(elapsed)
}
