import {
  InvalidRutError,
  getInvalidRutError,
  clean,
  format,
  getBody,
  getVerifier,
  decompose,
  calculateVerifier,
  mask,
} from '../src'

describe('InvalidRutError', () => {
  describe('shape', () => {
    test('is an Error subclass with a stable code, name and generic message', () => {
      const err = new InvalidRutError()
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(InvalidRutError)
      expect(err.code).toBe('INVALID_RUT')
      expect(err.name).toBe('InvalidRutError')
      expect(err.message).toBe('Invalid RUT input')
    })

    test('can be matched structurally without string matching (the documented contract)', () => {
      const err = new InvalidRutError()
      // The whole point: consumers branch on instanceof / code, never on text.
      expect(err instanceof InvalidRutError).toBe(true)
      expect(err.code === 'INVALID_RUT').toBe(true)
    })
  })

  describe('thrown by every safe helper in default (throwing) mode', () => {
    const throwers: Array<[string, () => unknown]> = [
      ['clean', () => clean('not-a-rut')],
      ['format', () => format('not-a-rut')],
      ['getBody', () => getBody('not-a-rut')],
      ['getVerifier', () => getVerifier('not-a-rut')],
      ['decompose', () => decompose('not-a-rut')],
      ['calculateVerifier', () => calculateVerifier('xx')],
      ['mask', () => mask('not-a-rut')],
      ['format (wrong verifier)', () => format('12.345.678-9')],
    ]

    test.each(throwers)('%s throws an InvalidRutError', (_label, fn) => {
      expect(fn).toThrow(InvalidRutError)
    })

    test.each(throwers)('%s thrown error carries code INVALID_RUT and never echoes the input', (_label, fn) => {
      try {
        fn()
        throw new Error('expected a throw')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidRutError)
        expect((err as InvalidRutError).code).toBe('INVALID_RUT')
        expect((err as Error).message).toBe('Invalid RUT input')
        expect((err as Error).message).not.toMatch(/not-a-rut|12345678/)
      }
    })
  })

  describe('getInvalidRutError (deprecated, retained for v3 compatibility)', () => {
    test('still returns the same generic message as the error', () => {
      expect(getInvalidRutError()).toBe('Invalid RUT input')
      expect(getInvalidRutError()).toBe(new InvalidRutError().message)
    })
  })
})
