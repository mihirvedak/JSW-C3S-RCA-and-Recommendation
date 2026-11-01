/**
 * Thin IOsense API client.
 *
 * FSV signals failure as HTTP 200 with `success: false`, so the status code is never
 * trusted on its own — every response is unwrapped through `unwrap()`.
 */

import { getStoredToken, rejectStoredToken } from '../auth/tokenStore'

/** Dev: Vite proxies `/api` to the connector so the browser is not blocked by CORS. */
const API_BASE = import.meta.env.VITE_IOSENSE_API_BASE ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly route: string
  readonly method: string
  /** First part of the response body, when it was not the JSON we expected. */
  readonly bodySnippet?: string

  /**
   * True for the failures that come from the transport, not from the request: no response, a
   * gateway error, or a 2xx whose body was cut off (empty). Worth retrying, or asking for less.
   */
  get transient(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504 || (this.status >= 200 && this.status < 300 && this.bodySnippet === '')
  }

  constructor(
    message: string,
    status: number,
    route: string,
    method = 'GET',
    bodySnippet?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.route = route
    this.method = method
    this.bodySnippet = bodySnippet
  }
}

export class AuthError extends ApiError {
  constructor(message: string, status: number, route: string, method = 'GET') {
    super(message, status, route, method)
    this.name = 'AuthError'
  }
}

/** Plain-language hint for the statuses that are about transport, not about the data. */
function hintForStatus(status: number, method: string, route: string): string | null {
  switch (status) {
    case 405:
      return (
        `The server refused ${method} on this path (405 Method Not Allowed). ` +
        `The IOsense connector does accept ${method} ${route}, so the rejection is ` +
        `almost certainly from a proxy or gateway in front of it rather than from the API.`
      )
    case 404:
      return 'The route was not found — check that /api is being proxied to the connector.'
    case 502:
    case 503:
    case 504:
      return 'The connector could not be reached through the proxy.'
    default:
      return null
  }
}

interface Envelope<T> {
  success: boolean
  data?: T
  errors?: unknown
}

function describeErrors(errors: unknown): string {
  if (!errors) return 'Request failed'
  if (typeof errors === 'string') return errors
  if (Array.isArray(errors)) {
    return (
      errors
        .map((e) => (typeof e === 'string' ? e : JSON.stringify(e)))
        .join('; ') || 'Request failed'
    )
  }
  return JSON.stringify(errors)
}

async function request<T>(
  route: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<Envelope<T>> {
  const token = getStoredToken()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', token)

  const method = init.method ?? 'GET'

  let res: Response
  try {
    // Never through the HTTP cache: live device data must not be answered from a stored copy, and a
    // response the connector once cut off (seen live 2026-10-31: HTTP 200, empty body) must not be
    // revalidated with a 304 and served back empty on every later load.
    res = await fetch(`${API_BASE}${route}`, { ...init, headers, cache: 'no-store' })
  } catch (cause) {
    // A request the caller cancelled (a newer selection superseded it) is not a failure.
    // Re-throw it as the abort it is so callers can ignore it, rather than reporting a
    // network error for something that was meant to stop.
    if (init.signal?.aborted) throw cause
    // Network-level failure: no response at all.
    throw new ApiError(
      cause instanceof Error ? cause.message : 'Network request failed',
      0,
      route,
      method,
    )
  }

  if (res.status === 401) {
    // The stored credential is dead. Drop it so the app returns to the sign-in gate
    // instead of replaying it on every reload.
    rejectStoredToken()
    throw new AuthError(
      'The platform rejected this session token (401). Sign in again.',
      401,
      route,
      method,
    )
  }

  // Read the body as text first: an error from a proxy is usually HTML, and reporting
  // "malformed response" for that hides the status that actually explains the failure.
  const raw = await res.text().catch((err: unknown) => {
    // Cancelled while the body was still downloading: an abort, not an empty response.
    if (init.signal?.aborted) throw err
    return ''
  })

  let body: Envelope<T> | null = null
  try {
    body = raw ? (JSON.parse(raw) as Envelope<T>) : null
  } catch {
    body = null
  }

  if (body == null) {
    const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 200)
    const hint = hintForStatus(res.status, method, route)
    const detail =
      hint ??
      (snippet === '' && res.ok
        ? `The platform answered ${method} ${route} with HTTP ${res.status} and an empty body: the response was cut off upstream, usually because the request was too large or too slow for the connector or a gateway in front of it.`
        : `Expected JSON from ${method} ${route} but got a non-JSON body.`)
    // Logged in full so the failing call is identifiable from the console.
    console.error(`[api] ${method} ${route} → HTTP ${res.status}`, {
      contentType: res.headers.get('content-type'),
      body: snippet,
    })
    throw new ApiError(`HTTP ${res.status} — ${detail}`, res.status, route, method, snippet)
  }

  if (!res.ok && res.status >= 400) {
    const described = describeErrors(body.errors)
    const hint = hintForStatus(res.status, method, route)
    throw new ApiError(
      hint ? `HTTP ${res.status} — ${hint}` : described || `HTTP ${res.status}`,
      res.status,
      route,
      method,
    )
  }

  return body
}

/** Unwraps the `{ success, data }` envelope, raising on `success: false`. */
export async function call<T>(
  route: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const method = init.method ?? 'GET'
  const body = await request<T>(route, init)
  if (!body.success) {
    const message = describeErrors(body.errors)
    // Permission denials arrive as HTTP 200 with success:false.
    if (/permission|session expired|authentication|authorization/i.test(message)) {
      // Only a dead session is worth discarding the token for. A per-resource
      // permission denial ("Device not added in Account") says nothing about the
      // credential, so signing the user out over it would be wrong.
      if (/session expired|logging-in again|invalid authorization/i.test(message)) {
        rejectStoredToken()
      }
      throw new AuthError(message, 200, route, method)
    }
    throw new ApiError(message, 200, route, method)
  }
  return body.data as T
}

export const api = {
  get: <T>(route: string, signal?: AbortSignal) => call<T>(route, { method: 'GET', signal }),
  put: <T>(route: string, payload: unknown, signal?: AbortSignal) =>
    call<T>(route, { method: 'PUT', body: JSON.stringify(payload), signal }),
}

/** The SSO exchange returns its token at the top level, outside the `data` envelope. */
export async function exchangeSsoToken(ssoToken: string): Promise<string> {
  const route = `/api/retrieve-sso-token/${encodeURIComponent(ssoToken)}`
  const body = await request<never>(route, { method: 'GET' })
  const token = (body as unknown as { token?: string }).token
  if (!body.success || !token) {
    throw new ApiError(describeErrors(body.errors) || 'Invalid or expired SSO token', 400, route)
  }
  return token
}
