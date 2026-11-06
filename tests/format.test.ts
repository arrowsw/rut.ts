import { format } from '../src'

describe('format', () => {
  describe('standard formatting (non-incremental)', () => {
    test.each([
      ['189726317', { dots: true }, '18.972.631-7'],
      ['189726317', { dots: false }, '18972631-7'],
      ['123456785', { dots: true }, '12.345.678-5'],
      ['123456785', { dots: false }, '12345678-5'],
      ['14625621k', undefined, '14.625.621-K'],
      ['09068826K', undefined, '9.068.826-K'],
      ['0012345674', undefined, '1.234.567-4'],
      ['009068826K', undefined, '9.068.826-K'],
      ['14.625.621-k', undefined, '14.625.621-K'],
      ['12#345#678#5', undefined, '12.345.678-5'],
      [' 123 456 785 ', undefined, '12.345.678-5'],
      ['12-345-678-5', undefined, '12.345.678-5'],
      ['18.972.631-7', undefined, '18.972.631-7'], // idempotent on canonical input
      ['9.068.826-K', undefined, '9.068.826-K'],
      ['10000130', undefined, '1.000.013-0'], // verifier 0 boundary
    ])('format(%p, %p) === %p', (rut, options, expected) => {
      expect(format(rut, options)).toBe(expected)
    })

    test('format is idempotent on its own output', () => {
      for (const input of ['18.972.631-7', '14.625.621-K', '9.068.826-K']) {
        const once = format(input)
        expect(format(once)).toBe(once)
      }
    })

    test('returns empty string for empty input (does not throw)', () => {
      expect(format('')).toBe('')
    })
  })

  describe('verifier validation (v4 breaking change #1)', () => {
    // v3 silently "repaired" an incorrect verifier; v4 rejects.
    test('throws on numeric wrong verifier (default mode)', () => {
      expect(() => format('123456789')).toThrow('Invalid RUT input')
    })

    test('throws on K-verifier mismatch (default mode)', () => {
      // body 1234567 has DV 4, not K — v3 used to "repair" this; v4 rejects.
      expect(() => format('1234567K')).toThrow('Invalid RUT input')
      // body 12345678 has DV 5, not K.
      expect(() => format('12345678K')).toThrow('Invalid RUT input')
    })

    test('returns null in safe mode for any wrong verifier', () => {
      expect(format('123456789', { throwOnError: false })).toBeNull()
      expect(format('1234567K', { throwOnError: false })).toBeNull()
      expect(format('12345678K', { throwOnError: false })).toBeNull()
    })

    test('does not echo the input in the error message (PII protection)', () => {
      expect(() => format('123456789')).not.toThrow(/123/)
    })
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', '', 'empty string short-circuits to ""'],
      ['189726317', '18.972.631-7', 'valid RUT formats normally'],
    ])('format(%p, { throwOnError: false }) === %p (%s)', (input, expected, _label) => {
      expect(format(input, { throwOnError: false })).toBe(expected)
    })

    test('supports throwOnError combined with other options', () => {
      expect(format('189726317', { dots: false, throwOnError: false })).toBe('18972631-7')
    })

    test.each([
      ['123', 'too short'],
      ['1234567', '7 chars'],
      ['12345678901', '11 chars'],
      ['123456789', 'wrong verifier'],
      ['K234567-8', 'K at the start'],
      ['1234K678-9', 'K in the middle'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(format(input, { throwOnError: false })).toBeNull()
    })

    test.each([
      [123456785, 'number'],
      [null, 'null'],
      [undefined, 'undefined'],
      [{}, 'object'],
      [Symbol('rut'), 'symbol'],
    ])('returns null for non-string input: %p (%s)', (value, _label) => {
      expect(format(value as unknown as string, { throwOnError: false })).toBeNull()
    })
  })

  describe('error mode (default)', () => {
    test.each([['1234567'], ['123'], ['12345678901'], ['K234567-8'], ['1234K678-9']])(
      'throws for invalid input: %p',
      (input) => {
        expect(() => format(input)).toThrow('Invalid RUT input')
      },
    )
  })

  describe('security — MAX_RUT_INPUT_LENGTH (64) cap', () => {
    test('accepts input padded to exactly 64 chars in non-incremental mode', () => {
      const padded = '0'.repeat(55) + '123456785' // length 64, valid DV
      expect(padded.length).toBe(64)
      expect(format(padded)).toBe('12.345.678-5')
    })

    test('rejects input at 65 chars (over the cap)', () => {
      const overCap = '0'.repeat(56) + '123456785'
      expect(overCap.length).toBe(65)
      expect(format(overCap, { throwOnError: false })).toBeNull()
      expect(() => format(overCap)).toThrow('Invalid RUT input')
    })
  })

  describe('incremental mode — progressive formatting', () => {
    test.each([
      ['1', '1'],
      ['12', '12'],
      ['123', '123'],
      ['1234', '1.234'],
      ['12345', '12.345'],
      ['123456', '123.456'],
      ['1234567', '1.234.567'],
      // hyphen appears at 8+ chars (complete)
      ['12345678', '1.234.567-8'],
      ['123456789', '12.345.678-9'],
    ])('format(%p, { incremental: true }) === %p (length sweep 1..9)', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['1234', '1234'],
      ['12345678', '1234567-8'],
      ['123456789', '12345678-9'],
    ])('with dots:false, format(%p, incremental) === %p', (input, expected) => {
      expect(format(input, { incremental: true, dots: false })).toBe(expected)
    })

    test.each([
      ['1234567K', '1.234.567-K'],
      ['1234567k', '1.234.567-K'],
      ['12345678K', '12.345.678-K'],
    ])('K verifier (case-insensitive) in incremental: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['', ''],
      ['   ', ''], // whitespace-only normalizes to empty
      ['00000000', ''], // all zeros strip to empty
      ['00001234', '1.234'],
      ['00012345678', '1.234.567-8'],
    ])('strips leading zeros / empty edge cases: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['12.345', '12.345'],
      ['12-345-678', '1.234.567-8'],
      ['12#34#56#78', '1.234.567-8'],
    ])('cleans input while formatting incrementally: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test('caps very long inputs to the maximum RUT length (v4 breaking change #7)', () => {
      expect(format('12345678901234', { incremental: true })).toBe('12.345.678-9')
    })

    test('caps to 9 significant chars and drops a trailing K beyond the cap', () => {
      // A trailing K is preserved only while the value still fits in 9 chars.
      expect(format('123456785K', { incremental: true })).toBe('12.345.678-5')
      expect(format('12.345.678-K', { incremental: true })).toBe('12.345.678-K')
      // ...but once normalization yields >9 significant chars, the cap to
      // MAX_RUT_LENGTH (9) keeps the first 9 digits and the K is dropped.
      // This only affects live-typing display; final values must still be
      // checked with `validate()`.
      expect(format('1234567890K', { incremental: true })).toBe('12.345.678-9')
      expect(format('12345678901234K', { incremental: true })).toBe('12.345.678-9')
    })

    test('silently drops a K that is not the trailing character', () => {
      // Locks in observed behavior so a refactor cannot silently regress it.
      // These inputs would never come from a normal typing flow, but a paste
      // could produce them — the renderer keeps only digits + trailing K.
      expect(format('K12345678', { incremental: true })).toBe('1.234.567-8')
      expect(format('1234K5678', { incremental: true })).toBe('1.234.567-8')
      expect(format('KK345678', { incremental: true })).toBe('345.678')
    })

    describe('trailing hyphen — body complete, verifier pending', () => {
      // The hyphen is the only signal that distinguishes an 8-digit body
      // awaiting its verifier (`12345678-`) from a 7-digit body + verifier
      // (`1234567-8`). Dropping it made the field re-split the body as soon
      // as the user typed (or deleted) the verifier.
      test.each([
        ['12345678-', '12.345.678-'],
        ['12.345.678-', '12.345.678-'],
        ['1234567-', '1.234.567-'],
        ['1.234.567-', '1.234.567-'],
        ['012345678-', '12.345.678-'], // leading zeros stripped, as everywhere else
        ['12345678- ', '12.345.678-'], // trailing garbage after the hyphen is ignored
        // A controlled input already showing `1.234.567-8` when the user types `-`.
        ['1.234.567-8-', '12.345.678-'],
      ])('format(%p, { incremental: true }) === %p', (input, expected) => {
        expect(format(input, { incremental: true })).toBe(expected)
      })

      test.each([
        ['12345678-', '12345678-'],
        ['1234567-', '1234567-'],
        ['12.345.678-', '12345678-'],
      ])('with dots:false, format(%p, incremental) === %p', (input, expected) => {
        expect(format(input, { incremental: true, dots: false })).toBe(expected)
      })

      test('ignores the hyphen once 9 or more digits precede it (cap to 9 significant chars)', () => {
        expect(format('123456789-', { incremental: true })).toBe('12.345.678-9')
        expect(format('12345678901234-', { incremental: true })).toBe('12.345.678-9')
      })

      test('a hyphen after fewer than 7 digits is still stripped', () => {
        expect(format('123456-', { incremental: true })).toBe('123.456')
        expect(format('12-', { incremental: true })).toBe('12')
        expect(format('-', { incremental: true })).toBe('')
      })

      test('a hyphen that is not the last significant character is still stripped', () => {
        expect(format('12345678-5', { incremental: true })).toBe('12.345.678-5')
        expect(format('1234567-K', { incremental: true })).toBe('1.234.567-K')
        expect(format('12-345-678', { incremental: true })).toBe('1.234.567-8')
      })

      test('a hyphen after a K is ignored — the K already closed the value', () => {
        expect(format('1234567K-', { incremental: true })).toBe('1.234.567-K')
      })
    })

    describe('K is always the verifier', () => {
      // A K can never be part of the body, so the moment it is typed the
      // digits before it are the (possibly short) body and the K is the
      // verifier. Previously `76120K` rendered as `761.20K`.
      test.each([
        ['76120K', '76.120-K'],
        ['7612k', '7.612-K'],
        ['123K', '123-K'],
        ['7k', '7-K'],
      ])('format(%p, { incremental: true }) === %p', (input, expected) => {
        expect(format(input, { incremental: true })).toBe(expected)
      })

      test.each([
        ['76120K', '76120-K'],
        ['7k', '7-K'],
      ])('with dots:false, format(%p, incremental) === %p', (input, expected) => {
        expect(format(input, { incremental: true, dots: false })).toBe(expected)
      })

      test('inputs of 8 or more chars ending in K are unchanged', () => {
        expect(format('7612012k', { incremental: true })).toBe('7.612.012-K')
        expect(format('1234567K', { incremental: true })).toBe('1.234.567-K')
        expect(format('12345678K', { incremental: true })).toBe('12.345.678-K')
      })

      test('a bare K (no body yet) renders as K, never as a lone hyphen', () => {
        expect(format('K', { incremental: true })).toBe('K')
        expect(format('0K', { incremental: true })).toBe('K')
      })
    })

    describe('keystroke-by-keystroke sequence', () => {
      test('typing 123456785 with an explicit hyphen, then backspacing over the verifier', () => {
        // Raw input at each keystroke (as the task that found the bug describes it).
        const typing: [string, string][] = [
          ['1', '1'],
          ['12', '12'],
          ['123', '123'],
          ['1234', '1.234'],
          ['12345', '12.345'],
          ['123456', '123.456'],
          ['1234567', '1.234.567'],
          ['12345678', '1.234.567-8'],
          ['12345678-', '12.345.678-'],
          ['12345678-5', '12.345.678-5'],
        ]
        for (const [input, expected] of typing) {
          expect(format(input, { incremental: true })).toBe(expected)
        }

        // Backspace from the complete value: the hyphen keeps the 8-digit body
        // together; once it is deleted too, the 8 remaining digits fall back to
        // the documented 7-digit-body + verifier reading.
        expect(format('12.345.678-5', { incremental: true })).toBe('12.345.678-5')
        expect(format('12.345.678-', { incremental: true })).toBe('12.345.678-')
        expect(format('12.345.678', { incremental: true })).toBe('1.234.567-8')
      })

      test('controlled input: each key is appended to the previously formatted value', () => {
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '-', '5']
        const expected = [
          '1',
          '12',
          '123',
          '1.234',
          '12.345',
          '123.456',
          '1.234.567',
          '1.234.567-8',
          '12.345.678-',
          '12.345.678-5',
        ]
        let value = ''
        keys.forEach((key, i) => {
          value = format(value + key, { incremental: true })
          expect(value).toBe(expected[i])
        })

        // Backspace twice: verifier, then hyphen.
        value = format(value.slice(0, -1), { incremental: true })
        expect(value).toBe('12.345.678-')
        value = format(value.slice(0, -1), { incremental: true })
        expect(value).toBe('1.234.567-8')
      })

      test('with dots:false the same sequence keeps the hyphen too', () => {
        const opts = { incremental: true, dots: false }
        expect(format('12345678', opts)).toBe('1234567-8')
        expect(format('12345678-', opts)).toBe('12345678-')
        expect(format('12345678-5', opts)).toBe('12345678-5')
        // Backspace: verifier, then hyphen.
        expect(format('12345678-', opts)).toBe('12345678-')
        expect(format('12345678', opts)).toBe('1234567-8')
      })
    })

    test('incremental mode never throws regardless of throwOnError', () => {
      // Documented contract: throwOnError is ignored in incremental mode.
      expect(() => format('@@@@', { incremental: true, throwOnError: true })).not.toThrow()
      expect(() => format('00000000', { incremental: true, throwOnError: true })).not.toThrow()
      expect(() => format('K@K@K@', { incremental: true, throwOnError: true })).not.toThrow()
      // Trailing-hyphen and K inputs introduced by the format-as-you-type fixes.
      for (const input of ['-', '--', '12345678-', '12345678--', 'K', '-K', 'K-', '7k', '1234567K-']) {
        expect(() => format(input, { incremental: true, throwOnError: true })).not.toThrow()
        expect(typeof format(input, { incremental: true, throwOnError: true })).toBe('string')
      }
    })
  })
})
