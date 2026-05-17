import { getInvalidRutError } from '../src'

/**
 * `getInvalidRutError` is part of the v4 public API. Its v3 signature
 * `(rut: string) => string` echoed the raw input into the message — which
 * leaked Chilean ID values into logs, traces and alerts. v4 changed it to
 * `(_rut?: unknown) => string` and made it always return the constant
 * `'Invalid RUT input'`.
 *
 * These tests anchor that contract so a future refactor cannot silently
 * re-introduce PII into the error message.
 */
describe('getInvalidRutError', () => {
  test('returns the canonical generic message', () => {
    expect(getInvalidRutError()).toBe('Invalid RUT input')
  })

  test.each([
    ['12.345.678-5', 'a valid-shaped RUT'],
    ['secret-rut-99.999.999-9', 'a RUT-shaped substring'],
    [{ pii: 'leak-me' } as unknown, 'an object payload'],
    [123456789 as unknown, 'a numeric payload'],
    [null as unknown, 'null'],
    [undefined as unknown, 'undefined'],
    [Symbol('rut') as unknown, 'a symbol'],
  ])('never echoes the input back (%p — %s)', (input) => {
    const message = getInvalidRutError(input)
    expect(message).toBe('Invalid RUT input')
    // Defensive negative assertion: nothing that could resemble the input
    // ever appears in the message, regardless of how it stringifies.
    expect(message).not.toMatch(/12345678|99999999|secret|leak/)
  })

  test('return value is referentially stable as a constant string', () => {
    expect(getInvalidRutError('a')).toBe(getInvalidRutError('b'))
  })
})
