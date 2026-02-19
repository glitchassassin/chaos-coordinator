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

/**
 * Format a timestamp for display.
 * Recent items (< 7 days) show relative time ("2 hours ago", "3 days ago").
 * Older items show absolute date ("Jan 15, 2026").
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = Date.now()
  const ms = now - date.getTime()
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(ms / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes.toString()} minute${minutes === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours.toString()} hour${hours === 1 ? '' : 's'} ago`
  if (days < 7) return `${days.toString()} day${days === 1 ? '' : 's'} ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
