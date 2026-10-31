/**
 * Authentication gate.
 *
 * The connector authenticates with a session JWT. There is no username/password route on
 * this API — the platform issues a one-time SSO handoff token which is exchanged for the
 * JWT. So this gate supports the two real paths:
 *
 *   1. `?token=<sso>` in the URL — exchanged once, stored, and stripped from the address bar.
 *   2. A session JWT pasted directly, for local development.
 *
 * No credentials are held in this repo; nothing is written to source. The token lives in
 * localStorage under `bearer_token`, which is the key the platform's own clients use.
 */

import { useEffect, useState } from 'react'
import {
  classifyToken,
  getStoredToken,
  normaliseToken,
  onTokenRejected,
  readSsoTokenFromUrl,
  setStoredToken,
  stripSsoTokenFromUrl,
} from './tokenStore'
import { exchangeSsoToken } from '../services/apiClient'
import { BrandLogo } from '../components/BrandLogo'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sso = readSsoTokenFromUrl()
    if (!sso) return

    let cancelled = false
    setExchanging(true)
    setError(null)

    exchangeSsoToken(sso)
      .then((jwt) => {
        if (cancelled) return
        // The exchange already returns a `Bearer `-prefixed token; store it verbatim.
        setStoredToken(jwt)
        setToken(jwt)
        stripSsoTokenFromUrl()
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'SSO exchange failed')
        stripSsoTokenFromUrl()
      })
      .finally(() => {
        if (!cancelled) setExchanging(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // The platform rejected the stored credential: return to the gate rather than leaving a
  // signed-in-looking dashboard where every request 401s.
  useEffect(
    () =>
      onTokenRejected(() => {
        setToken(null)
        setError('The platform rejected that session token. Sign in again.')
      }),
    [],
  )

  function signIn(raw: string) {
    const kind = classifyToken(raw)

    if (kind === 'unknown') {
      setError(
        raw.trim()
          ? 'That is not a session token. Paste the JWT the platform issues (three ' +
              'dot-separated parts, starting with “eyJ”), or open this app from the ' +
              'portal’s SSO link.'
          : 'Enter a session token.',
      )
      return
    }

    // A one-time SSO handoff is not a bearer credential — sending it as one is exactly
    // what the connector answers with 401. Exchange it for the session JWT instead.
    if (kind === 'sso-handoff') {
      setExchanging(true)
      setError(null)
      exchangeSsoToken(raw.trim().replace(/^bearer\s+/i, ''))
        .then((jwt) => {
          setStoredToken(jwt)
          setToken(jwt)
        })
        .catch((err: unknown) => {
          const detail = err instanceof Error ? err.message : 'exchange failed'
          setError(
            `That looks like a one-time SSO token, and the platform would not exchange ` +
              `it (${detail}). These tokens are single-use and short-lived — open the ` +
              `app again from a fresh portal link.`,
          )
        })
        .finally(() => setExchanging(false))
      return
    }

    const normalised = normaliseToken(raw)
    setStoredToken(normalised)
    setToken(normalised)
    setError(null)
  }

  function signOut() {
    setToken(null)
  }

  return { token, exchanging, error, signIn, signOut, setError }
}

export function LoginGate({
  exchanging,
  error,
  onSignIn,
}: {
  exchanging: boolean
  error: string | null
  onSignIn: (token: string) => void
}) {
  const [value, setValue] = useState('')

  if (exchanging) {
    return (
      <div className="gate">
        <div className="gate__card">
          <span className="spinner spinner--lg" aria-hidden="true" />
          <h1>Completing sign-in…</h1>
          <p>Exchanging the single-use SSO token for a session.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="gate">
      <form
        className="gate__card"
        onSubmit={(e) => {
          e.preventDefault()
          onSignIn(value)
        }}
      >
        <BrandLogo large />

        <h1>C3S Quality Intelligence</h1>
        <p className="gate__lead">
          This dashboard reads live data from the IOsense platform. Open it from the portal
          with an SSO link, or paste a session token to continue. A one-time SSO token is
          exchanged for a session automatically.
        </p>

        <label className="gate__field">
          <span>Session token</span>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Bearer eyJhbGciOi…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {error ? <p className="gate__error" role="alert">{error}</p> : null}

        <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
          Continue
        </button>

        <p className="gate__hint">
          The token is stored in this browser only, under <code>bearer_token</code>. It is
          never written to the repository.
        </p>
      </form>
    </div>
  )
}
