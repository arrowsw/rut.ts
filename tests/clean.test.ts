import { clean } from '../src'

describe('clean', () => {
  describe('happy path — permissive normalization', () => {
    // `clean()` is intentionally permissive: it strips non-[0-9kK], leading
    // zeros, and uppercases. It does NOT validate the verifier digit — that
    // is `validate()`'s job. These cases document the normalization contract.
    test.each([
      ['12.345.678-k', '12345678K', 'canonical dotted, lowercase k'],
      ['12.345.678-K', '12345678K', 'canonical dotted, uppercase K'],
      ['0000012.345.678-K', '12345678K', 'many leading zeros'],
      ['00009.068.826-K', '9068826K', '7-digit body + leading zeros'],
      ['00000012345678K', '12345678K', 'compact + many leading zeros'],
      ['123456789', '123456789', 'compact already-clean numeric'],
      ['12345678K', '12345678K', 'compact already-clean with K'],
      [' 12 345 6 78 - 9 ', '123456789', 'whitespace + hyphens scattered'],
      ['   12345678K   ', '12345678K', 'surrounding whitespace'],
      ['12-34-56-789', '123456789', 'extra hyphens'],
      ['12-345-678-K', '12345678K', 'extra hyphens with K'],
      ['12#34%56&@78K', '12345678K', 'special characters interleaved'],
      ['12.345.678@#$-K', '12345678K', 'trailing garbage before verifier'],
      ['12345678#', '12345678', 'trailing garbage stripped'],
      ['12345678K###', '12345678K', 'trailing garbage after K'],
      ['(12.345.678-K)', '12345678K', 'parentheses around RUT'],
      ['12.345.678.K', '12345678K', 'dot before verifier'],
      ['9068826k', '9068826K', 'compact lowercase k uppercased'],
      ['10000002', '10000002', 'minimum-length 8-digit numeric'],
      ['999999996', '999999996', 'maximum-length 9-char numeric'],
    ])('clean(%p) === %p (%s)', (input, expected, _label) => {
      expect(clean(input)).toBe(expected)
    })
  })

  describe('safe mode — returns null instead of throwing', () => {
    test.each([
      ['', 'empty'],
      ['   ', 'whitespace only'],
      ['1.2.34-K', 'too short after normalization'],
      ['123', 'too short'],
      ['1234567', '7 chars (under MIN_RUT_LENGTH)'],
      ['12.345.6789012-3', 'too long after normalization'],
      ['12345678901', '11 chars (over MAX_RUT_LENGTH)'],
      ['K1234567', 'K not at the end (leading)'],
      ['1234K567', 'K in the middle'],
      ['KK345678', 'multiple K'],
      ['1234567KK', 'trailing multiple K'],
      ['####', 'only invalid characters'],
      ['abcdefgh', 'only alphabetic'],
      ['--------', 'only separators'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(clean(input, { throwOnError: false })).toBeNull()
    })

    test.each([
      [123456789, 'number'],
      [null, 'null'],
      [undefined, 'undefined'],
      [{}, 'object'],
      [Symbol('rut'), 'symbol'],
    ])('returns null for non-string input: %p (%s)', (value, _label) => {
      expect(clean(value as unknown as string, { throwOnError: false })).toBeNull()
    })

    test.each([
      ['12.345.678-k', '12345678K'],
      ['9.068.826-K', '9068826K'],
      ['189726317', '189726317'],
    ])('returns cleaned value for valid input: %p → %p', (input, expected) => {
      expect(clean(input, { throwOnError: false })).toBe(expected)
    })
  })

  describe('error mode (default — throwOnError defaults to true)', () => {
    test('throws a generic error message that never echoes the input (PII protection)', () => {
      // Regression test for v4 breaking change #4 / security item #3:
      // the message must be the constant 'Invalid RUT input'.
      expect(() => clean('123')).toThrow('Invalid RUT input')
      expect(() => clean('123')).not.toThrow(/123/)
      expect(() => clean('secret-rut-leak')).toThrow('Invalid RUT input')
      expect(() => clean('secret-rut-leak')).not.toThrow(/secret|leak/)
    })

    test.each([
      [''],
      ['   '],
      ['1.2.34-K'],
      ['12.345.6789012-3'],
      ['1234567'],
      ['12345678901'],
      ['K1234567'],
      ['1234K567'],
      ['1234567KK'],
      ['####'],
      ['abcdefgh'],
    ])('throws for invalid input: %p', (input) => {
      expect(() => clean(input)).toThrow('Invalid RUT input')
    })

    test('does not throw for the minimum and maximum lengths after normalization', () => {
      expect(() => clean('1234567K')).not.toThrow()
      expect(() => clean('12345678K')).not.toThrow()
    })
  })

  describe('security — MAX_RUT_INPUT_LENGTH (64) cap', () => {
    test('accepts input padded to exactly 64 chars', () => {
      const padded = '0'.repeat(55) + '123456785'
      expect(padded.length).toBe(64)
      expect(clean(padded)).toBe('123456785')
    })

    test('rejects input at 65 chars (over the cap)', () => {
      const overCap = '0'.repeat(56) + '123456785'
      expect(overCap.length).toBe(65)
      expect(clean(overCap, { throwOnError: false })).toBeNull()
      expect(() => clean(overCap)).toThrow('Invalid RUT input')
    })
  })

  describe('idempotency', () => {
    // Normalization should be a fixed point on its own output. Detects any
    // drift introduced by future refactors of the normalization helpers.
    test.each(['12.345.678-5', '14.625.621-k', '009.068.826-K', ' 12 345 6 78 - 9 ', '(18.972.631-7)'])(
      'clean(clean(%p)) === clean(%p)',
      (input) => {
        const once = clean(input)
        expect(clean(once)).toBe(once)
      },
    )
  })
})
