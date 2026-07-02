/** Format minutes as "2h 30m" or "45m". Safe to import from Server and Client Components. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
