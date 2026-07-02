import { equals, validate } from '../src'

describe('equals', () => {
  describe('default mode (requireValid: true) — same RUT *and* actually a RUT', () => {
    describe('true — same valid RUT across different shapes', () => {
      test.each([
        ['12.345.678-5', '123456785', 'dotted vs compact'],
        ['12.345.678-5', '12345678-5', 'dotted vs compact+hyphen'],
        ['123456785', '12345678-5', 'compact vs compact+hyphen'],
        ['12.345.678-5', '  12.345.678-5  ', 'whitespace difference'],
        ['14.625.621-K', '14.625.621-k', 'verifier case difference'],
        ['9.068.826-K', '0009068826K', 'leading zeros difference'],
        ['012345678-5', '12.345.678-5', 'zero-padded vs canonical'],
        ['12.345.678-5', '12.345.678-5', 'identical'],
      ])('equals(%p, %p) === true (%s)', (a, b) => {
        expect(equals(a, b)).toBe(true)
      })
    })

    describe('false — same normalized shape but not a valid RUT (Modulo 11 checked)', () => {
      test.each([
        ['12345678-9', '12345678-9', 'identical strings with a wrong verifier'],
        ['12.345.678-9', '123456789', 'same wrong-verifier value across shapes'],
        ['00012345679', '12345678-9', 'zero-padded wrong verifier'],
      ])('equals(%p, %p) === false (%s)', (a, b) => {
        expect(equals(a, b)).toBe(false)
      })
    })

    describe('false — different RUTs', () => {
      test.each([
        ['12.345.678-5', '1.234.567-4', 'different bodies'],
        ['12345678-5', '12345678-9', 'same body, different verifier char'],
        ['12.345.678-5', '98.765.432-1', 'unrelated'],
      ])('equals(%p, %p) === false (%s)', (a, b) => {
        expect(equals(a, b)).toBe(false)
      })
    })

    describe('false — one or both arguments are not clean-able RUTs', () => {
      test.each([
        ['12.345.678-5', 'nope', 'second invalid'],
        ['nope', '12.345.678-5', 'first invalid'],
        ['nope', 'also-nope', 'both invalid'],
        ['', '', 'both empty'],
      ])('equals(%p, %p) === false (%s)', (a, b) => {
        expect(equals(a, b)).toBe(false)
      })

      test.each([
        [123456785, '123456785'],
        ['123456785', null],
        [null, undefined],
        [{}, '12345678-5'],
      ])('equals(%p, %p) === false (non-string)', (a, b) => {
        expect(equals(a as unknown, b as unknown)).toBe(false)
      })
    })

    test('explicit { requireValid: true } behaves exactly like the default', () => {
      expect(equals('12.345.678-5', '123456785', { requireValid: true })).toBe(true)
      expect(equals('12345678-9', '12345678-9', { requireValid: true })).toBe(false)
    })

    test('coherence rule: validity is checked on the normalized value, not the canonical shape', () => {
      // The padded shape is rejected by validate() yet accepted by equals():
      // equals is a normalization operation by definition — requireValid adds
      // exactly one thing (the Modulo 11 check), not validate()'s shape contract.
      expect(validate('012345678-5')).toBe(false)
      expect(equals('012345678-5', '12.345.678-5')).toBe(true)
    })
  })

  describe('legacy mode — { requireValid: false } preserves the 4.x normalization comparison', () => {
    describe('true — same normalized shape', () => {
      test.each([
        ['12.345.678-5', '123456785', 'dotted vs compact'],
        ['12.345.678-5', '12345678-5', 'dotted vs compact+hyphen'],
        ['123456785', '12345678-5', 'compact vs compact+hyphen'],
        ['12.345.678-5', '  12.345.678-5  ', 'whitespace difference'],
        ['14.625.621-K', '14.625.621-k', 'verifier case difference'],
        ['9.068.826-K', '0009068826K', 'leading zeros difference'],
        ['12.345.678-5', '12.345.678-5', 'identical'],
      ])('equals(%p, %p, { requireValid: false }) === true (%s)', (a, b) => {
        expect(equals(a, b, { requireValid: false })).toBe(true)
      })
    })

    describe('false — different RUTs', () => {
      test.each([
        ['12.345.678-5', '1.234.567-4', 'different bodies'],
        ['12345678-5', '12345678-9', 'same body, different verifier char'],
        ['12.345.678-5', '98.765.432-1', 'unrelated'],
      ])('equals(%p, %p, { requireValid: false }) === false (%s)', (a, b) => {
        expect(equals(a, b, { requireValid: false })).toBe(false)
      })
    })

    describe('false — one or both arguments are not clean-able RUTs', () => {
      test.each([
        ['12.345.678-5', 'nope', 'second invalid'],
        ['nope', '12.345.678-5', 'first invalid'],
        ['nope', 'also-nope', 'both invalid'],
        ['', '', 'both empty'],
      ])('equals(%p, %p, { requireValid: false }) === false (%s)', (a, b) => {
        expect(equals(a, b, { requireValid: false })).toBe(false)
      })

      test.each([
        [123456785, '123456785'],
        ['123456785', null],
        [null, undefined],
        [{}, '12345678-5'],
      ])('equals(%p, %p, { requireValid: false }) === false (non-string)', (a, b) => {
        expect(equals(a as unknown, b as unknown, { requireValid: false })).toBe(false)
      })
    })

    test('comparison ignores the Modulo-11 checksum (normalizes shape only) — the dedup use case', () => {
      // Both carry an invalid checksum but normalize identically: the same typo
      // in two rows of a dirty dataset is still the same entity.
      expect(equals('12.345.678-9', '123456789', { requireValid: false })).toBe(true)
      expect(equals('12345678-9', '12345678-9', { requireValid: false })).toBe(true)
    })
  })

  describe('symmetry', () => {
    test.each([
      ['12.345.678-5', '123456785'],
      ['12345678-9', '123456789'],
      ['012345678-5', '12.345.678-5'],
      ['nope', '12.345.678-5'],
    ])('equals(%p, %p) === equals(%p, %p) in both modes', (a, b) => {
      expect(equals(a, b)).toBe(equals(b, a))
      expect(equals(a, b, { requireValid: false })).toBe(equals(b, a, { requireValid: false }))
    })
  })
})
