import { validate, isRutLike } from '../src'

describe('validate', () => {
  describe('type safety (accepts unknown)', () => {
    test.each([
      [123456789, 'number'],
      [null, 'null'],
      [undefined, 'undefined'],
      [{}, 'object'],
      [[], 'array'],
      [true, 'boolean true'],
      [false, 'boolean false'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
      [-0, '-0'],
      [Symbol('rut'), 'symbol'],
    ])('returns false for non-string input: %p (%s)', (value, _label) => {
      expect(validate(value as unknown)).toBe(false)
    })
  })

  describe('valid RUTs — the three accepted shapes', () => {
    // Same RUT (12.345.678-5) across the three documented canonical shapes.
    // Replaces the older "different formats" / "should correctly validate" /
    // "validates 8-digit" / "validates 9-digit" duplicate blocks.
    test.each([
      ['12.345.678-5', 'canonical dotted'],
      ['12345678-5', 'compact with hyphen'],
      ['123456785', 'compact'],
      ['1.234.567-4', 'canonical dotted (7-digit body)'],
      ['1234567-4', 'compact-with-hyphen (7-digit body)'],
      ['12345674', 'compact (7-digit body)'],
    ])('accepts valid RUT in shape: %s (%s)', (rut) => {
      expect(validate(rut)).toBe(true)
    })

    test.each([
      ['14.625.621-K', 'uppercase K'],
      ['14.625.621-k', 'lowercase k'],
      ['14625621K', 'compact uppercase'],
      ['14625621k', 'compact lowercase'],
    ])('accepts K verifier (case-insensitive): %s', (rut) => {
      expect(validate(rut)).toBe(true)
    })

    test.each([
      ['009.068.826-K', '7-digit body + 2 leading zeros'],
      ['0009068826K', 'compact + 3 leading zeros'],
      ['018.972.631-7', '8-digit body + 1 leading zero'],
      ['00012345674', 'compact + 3 leading zeros (7-digit body, DV 4)'],
    ])('accepts leading zeros: %s', (rut) => {
      expect(validate(rut)).toBe(true)
    })

    test('accepts verifier digit 0 (covers the 11 - sum%11 === 11 branch of Modulo-11)', () => {
      expect(validate('18.264.950-3')).toBe(true)
      // A RUT whose verifier is literally '0' — i.e. checkDigit === 11.
      expect(validate('10.000.004-0')).toBe(true)
    })

    test('accepts the documented minimum and maximum body', () => {
      expect(validate('10.000.000-8')).toBe(true)
      expect(validate('010.000.002-4')).toBe(true) // normalizes to 10000024
      expect(validate('99.999.999-9')).toBe(true)
    })
  })

  describe('invalid RUTs', () => {
    test.each([
      ['18.972.631-8', 'wrong verifier on 8-digit body'],
      ['23.478.522-K', 'wrong verifier (K) on 8-digit body'],
      ['12.345.678-0', 'wrong verifier (0 instead of 5)'],
    ])('rejects wrong verifier: %s (%s)', (rut) => {
      expect(validate(rut)).toBe(false)
    })

    test.each([
      ['invalid', 'pure non-numeric'],
      ['abcdefghi', 'alphabetic only'],
      ['1.1.1-1', 'too few digits with dots'],
      ['', 'empty'],
      ['12#34%56&789K', 'special chars'],
      ['12,345,678-5', 'comma grouping (v4: rejected)'],
      ['12.345678-5', 'non-canonical grouping (v4 breaking change #2)'],
      ['12345.678-5', 'non-canonical grouping (v4 breaking change #2)'],
      ['1.2.3.4.5.6.7.8-5', 'every-digit-dotted (v4 breaking change #2)'],
      ['12 345 678 5', 'internal whitespace (only the three shapes are accepted)'],
      ['K2345678-5', 'K not at end (leading)'],
      ['1234K678-5', 'K not at end (middle)'],
      ['1234567K-K', 'multiple K'],
      ['KK345678-5', 'multiple K (leading)'],
    ])('rejects invalid input: %p (%s)', (rut) => {
      expect(validate(rut)).toBe(false)
    })

    test.each([
      ['123', 'too short'],
      ['1234567', 'just under min length after leading-zero strip'],
      ['12345678901', 'too long but under 64-char cap'],
    ])('rejects out-of-range length: %p (%s)', (rut) => {
      expect(validate(rut)).toBe(false)
    })
  })

  describe('security — MAX_RUT_INPUT_LENGTH (64) cap', () => {
    // The cap is a security bound (defense against ReDoS-style abuse), not a
    // format rule. These boundary tests anchor the exact 64/65 split so a
    // future refactor cannot widen the cap silently.
    test('accepts a valid RUT padded with zeros to exactly 64 chars', () => {
      const padded = '0'.repeat(55) + '123456785' // length 64, normalizes to 123456785
      expect(padded.length).toBe(64)
      expect(validate(padded)).toBe(true)
    })

    test('rejects input at MAX_RUT_INPUT_LENGTH + 1 (65 chars)', () => {
      const overCap = '0'.repeat(56) + '123456785' // length 65
      expect(overCap.length).toBe(65)
      expect(validate(overCap)).toBe(false)
    })

    test('rejects far-over-cap adversarial input', () => {
      expect(validate(`${'0'.repeat(128)}x`)).toBe(false)
      expect(validate('1'.repeat(20000))).toBe(false)
    })

    test('is ReDoS-safe on a 100k-char adversarial input (catastrophic-backtracking regression)', () => {
      // Promoted from the gated differential suite. The v3 regex
      // `/^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/` exhibited catastrophic
      // backtracking on this input (~353 ms and growing super-linearly).
      // The v4 input is length-capped *before* any regex runs, so this must
      // resolve in well under 50 ms on any reasonable CI hardware.
      const adversarial = '0'.repeat(100_000) + 'x'
      const start = performance.now()
      const result = validate(adversarial)
      const elapsed = performance.now() - start
      expect(result).toBe(false)
      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('whitespace handling (v4 breaking change #3 — trim)', () => {
    test.each([
      ['  12.345.678-5  ', 'leading + trailing spaces'],
      ['\t12.345.678-5\n', 'tab + newline'],
      ['  123456785  ', 'compact with surrounding spaces'],
      ['\n14.625.621-K\t', 'K verifier with surrounding whitespace'],
    ])('accepts otherwise-valid input with surrounding whitespace: %p (%s)', (rut) => {
      expect(validate(rut)).toBe(true)
    })

    test('whitespace-only input is rejected', () => {
      expect(validate('   ')).toBe(false)
      expect(validate('\t\n')).toBe(false)
    })

    test('surrounding whitespace does not turn invalid into valid', () => {
      expect(validate('  invalid  ')).toBe(false)
      expect(validate('  12.345.678-0  ')).toBe(false) // wrong verifier
    })
  })

  describe('Unicode / non-ASCII inputs (anti-spoofing)', () => {
    // The invalidRutChars regex is ASCII-only ([^0-9kK]). These tests anchor
    // that policy so look-alike characters cannot bypass validation.
    test.each([
      ['१२३४५६७८-५', 'Devanagari digits'],
      ['１２３４５６７８-５', 'fullwidth digits'],
      ['‮12345678-5', 'leading RTL override mark'],
      ['12345678-5​', 'trailing zero-width space'],
      ['12.345.678-К', 'Cyrillic К (U+041A) instead of ASCII K'],
    ])('rejects non-ASCII look-alike input: %p (%s)', (rut) => {
      expect(validate(rut)).toBe(false)
    })
  })

  describe('strict mode', () => {
    test.each([
      ['11.111.111-1', 'all 1s'],
      ['22.222.222-2', 'all 2s'],
      ['33.333.333-3', 'all 3s'],
      ['8.888.888-K', 'all 8s with K (v4 fix for strict uppercase-K bypass)'],
      ['8888888K', 'all 8s with K — compact (regression for strict uppercase-K bypass)'],
    ])('rejects suspicious RUT in strict mode: %s', (rut) => {
      expect(validate(rut, { strict: true })).toBe(false)
    })

    test.each([[undefined], [{ strict: false } as const], [{} as const]])(
      'accepts suspicious RUT when strict is off / not provided (options=%p)',
      (opts) => {
        expect(validate('11111111-1', opts)).toBe(true)
      },
    )

    test('strict mode does not reject otherwise-valid RUTs', () => {
      expect(validate('12.345.678-5', { strict: true })).toBe(true)
      expect(validate('18.972.631-7', { strict: true })).toBe(true)
    })
  })
})

describe('isRutLike', () => {
  test.each([
    ['12.345.678-9', 'canonical dotted'],
    ['12345678-9', 'compact with hyphen'],
    ['123456789', 'compact'],
    ['1.234.567-K', 'canonical dotted 7-digit body, K verifier'],
    ['009.068.826-K', 'with leading zeros'],
    ['00012345678', 'compact with leading zeros'],
    ['  12.345.678-5  ', 'with surrounding whitespace (v4 trim)'],
    ['12.345.678-k', 'lowercase k'],
  ])('returns true for shape-valid input: %p (%s)', (rut) => {
    expect(isRutLike(rut)).toBe(true)
  })

  test.each([
    ['abcdefghi', 'pure alphabetic'],
    ['', 'empty'],
    ['12.34.56-7', 'wrong dot grouping'],
    ['12.345678-5', 'non-canonical grouping'],
    ['12345.678-5', 'non-canonical grouping'],
    ['1'.repeat(128), 'over 64-char cap'],
    ['12 345 678 5', 'internal whitespace'],
    ['K2345678-5', 'K not at end'],
  ])('returns false for shape-invalid input: %p (%s)', (rut) => {
    expect(isRutLike(rut)).toBe(false)
  })

  test.each([
    [123456789, 'number'],
    [null, 'null'],
    [undefined, 'undefined'],
    [{}, 'object'],
  ])('returns false for non-string input: %p (%s)', (value, _label) => {
    expect(isRutLike(value as unknown)).toBe(false)
  })

  test('respects the 64-char cap at the exact boundary', () => {
    expect(isRutLike('0'.repeat(55) + '123456785')).toBe(true) // length 64
    expect(isRutLike('0'.repeat(56) + '123456785')).toBe(false) // length 65
  })
})
