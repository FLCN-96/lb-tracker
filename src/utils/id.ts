/**
 * Generates a short unique ID. Uses crypto.randomUUID when available,
 * with a simple fallback for older WebViews.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: timestamp + random suffix
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
