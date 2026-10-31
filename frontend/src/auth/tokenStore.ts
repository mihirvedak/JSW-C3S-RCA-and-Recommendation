/**
 * JWT resolution, following the IOsense authentication pattern.
 *
 *   1. `props.authentication` when embedded as a widget (not applicable to this app).
 *   2. `?token=` in the URL — a one-time SSO handoff, exchanged once and then stripped.
 *   3. `localStorage['bearer_token']` as the dev/persistent fallback.
 *
 * The token returned by the SSO exchange is already prefixed with `Bearer `. It is stored
 * and sent verbatim — never re-concatenated with another `Bearer `.
 */

const STORAGE_KEY = 'bearer_token'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private mode / blocked site data.
    return null
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {
    /* non-fatal: the token still lives in memory for this session */
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* non-fatal */
  }
}

/** Normalise a pasted token so exactly one `Bearer ` prefix is present. */
export function normaliseToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /^bearer\s/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`
}

/**
 * What kind of credential a pasted string is.
 *
 * The platform issues two different things and they are not interchangeable:
 *
 *   - a **session** credential, a JWT in three dot-separated parts, which is what goes in
 *     the `Authorization` header;
 *   - a **one-time SSO handoff**, an opaque hex string, which must first be exchanged at
 *     `/api/retrieve-sso-token/:token`.
 *
 * Sending a handoff token as a bearer is rejected by the connector with
 * `401 Invalid Authorization Bearer! Try Logging-in again!`, so the two are told apart
 * before anything is stored rather than after every request has already failed.
 */
export type TokenKind = 'session' | 'sso-handoff' | 'unknown'

export function classifyToken(raw: string): TokenKind {
  const value = raw.trim().replace(/^bearer\s+/i, '')
  if (!value) return 'unknown'
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) return 'session'
  if (/^[0-9a-f]{32,}$/i.test(value)) return 'sso-handoff'
  return 'unknown'
}

type Listener = () => void
const rejectionListeners = new Set<Listener>()

/** Subscribe to "the stored token was rejected by the platform". Returns an unsubscribe. */
export function onTokenRejected(listener: Listener): () => void {
  rejectionListeners.add(listener)
  return () => {
    rejectionListeners.delete(listener)
  }
}

/**
 * Drops the stored token and notifies subscribers.
 *
 * Called when the platform rejects the credential, so that a reload cannot keep replaying
 * a dead token: without this the app looks signed in and every request 401s until someone
 * clicks Sign out by hand.
 */
export function rejectStoredToken(): void {
  clearStoredToken()
  for (const listener of rejectionListeners) listener()
}

/** Reads `?token=` without consuming it. */
export function readSsoTokenFromUrl(): string | null {
  try {
    return new URL(window.location.href).searchParams.get('token')
  } catch {
    return null
  }
}

/** Removes `?token=` from the address bar after a successful exchange. */
export function stripSsoTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('token')) return
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* non-fatal */
  }
}
