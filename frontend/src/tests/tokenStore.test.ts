import { describe, expect, it } from 'vitest'
import { classifyToken, normaliseToken } from '../auth/tokenStore'

describe('classifyToken', () => {
  it('recognises a session JWT, with or without the Bearer prefix', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZGFuaSJ9.c2lnbmF0dXJl'
    expect(classifyToken(jwt)).toBe('session')
    expect(classifyToken(`Bearer ${jwt}`)).toBe('session')
    expect(classifyToken(`  bearer ${jwt}  `)).toBe('session')
  })

  it('recognises a one-time SSO handoff token', () => {
    // The value that was being stored as a bearer and 401ing on every request.
    expect(
      classifyToken('c100aeff965daf2c2b949d513b85cad07ca7622b82f38e045820163a76cfa89a'),
    ).toBe('sso-handoff')
    expect(classifyToken('C100AEFF965DAF2C2B949D513B85CAD0')).toBe('sso-handoff')
  })

  it('rejects anything that is neither', () => {
    expect(classifyToken('')).toBe('unknown')
    expect(classifyToken('   ')).toBe('unknown')
    expect(classifyToken('not-a-token')).toBe('unknown')
    expect(classifyToken('deadbeef')).toBe('unknown') // too short for a handoff
  })
})

describe('normaliseToken', () => {
  it('adds exactly one Bearer prefix and never doubles it', () => {
    expect(normaliseToken('abc')).toBe('Bearer abc')
    expect(normaliseToken('Bearer abc')).toBe('Bearer abc')
    expect(normaliseToken('bearer abc')).toBe('bearer abc')
    expect(normaliseToken('  ')).toBe('')
  })
})
