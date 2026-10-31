import { useEffect, useState } from 'react'

/**
 * A ticking clock.
 *
 * Relative ages ("12 min ago", "stale") are rendered all over the dashboard. Reading
 * `Date.now()` during render makes them impure and leaves them frozen until some other
 * state happens to change; this keeps them honest by re-rendering on a fixed interval.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
