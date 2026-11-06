import fc from 'fast-check'

import { generate, isRutLike, RUT_PATTERN, validate } from '../src'

const SHAPES = ['compact', 'hyphen', 'dotted'] as const
const re = {
  any: new RegExp(RUT_PATTERN.any),
  compact: new RegExp(RUT_PATTERN.compact),
  hyphen: new RegExp(RUT_PATTERN.hyphen),
  dotted: new RegExp(RUT_PATTERN.dotted),
}

// The shape an accepted (already trimmed) input is written in.
const shapeOf = (s: string) => (s.includes('.') ? 'dotted' : s.includes('-') ? 'hyphen' : 'compact')

// The property the export exists for: the patterns and the validator can never
// drift. `any` matches exactly what `isRutLike` accepts, and an accepted input
// matches exactly one of the three per-shape patterns.
const expectAgreement = (raw: string) => {
  const input = raw.trim()
  const accepted = isRutLike(raw)
  expect([raw, re.any.test(input)]).toEqual([raw, accepted])
  for (const shape of SHAPES) {
    expect([raw, shape, re[shape].test(input)]).toEqual([raw, shape, accepted && shapeOf(input) === shape])
  }
}

describe('RUT_PATTERN', () => {
  describe('the exported strings are frozen, byte for byte', () => {
    // These strings are public API: consumers paste them into schemas and
    // database constraints, so changing one character is a breaking change.
    test('exact values', () => {
      expect(RUT_PATTERN).toEqual({
        any: '^([1-9][0-9]{6,7}-?[0-9kK]|[1-9][0-9]?[.][0-9]{3}[.][0-9]{3}-[0-9kK])$',
        compact: '^[1-9][0-9]{6,7}[0-9kK]$',
        hyphen: '^[1-9][0-9]{6,7}-[0-9kK]$',
        dotted: '^[1-9][0-9]?[.][0-9]{3}[.][0-9]{3}-[0-9kK]$',
      })
    })

    test.each(Object.entries(RUT_PATTERN))('%s is anchored and backslash-free', (_name, pattern) => {
      expect(pattern.startsWith('^')).toBe(true)
      expect(pattern.endsWith('$')).toBe(true)
      // No backslash: nothing to double when the string is pasted into JSON,
      // YAML or a SQL literal, and no `\d` (which matches non-ASCII digits in
      // several engines).
      expect(pattern).not.toContain('\\')
    })

    test.each(Object.entries(RUT_PATTERN))('%s compiles with no flags, `u` and `v`', (_name, pattern) => {
      for (const flags of ['', 'u', 'v']) {
        expect(() => new RegExp(pattern, flags)).not.toThrow()
      }
    })
  })

  describe('agreement with isRutLike()', () => {
    test.each([
      ['123456785', 'compact, 8-digit body'],
      ['12345678-5', 'hyphen, 8-digit body'],
      ['12.345.678-5', 'dotted, 8-digit body'],
      ['1234567-4', 'hyphen, 7-digit body'],
      ['1.234.567-4', 'dotted, 7-digit body'],
      ['14625621-k', 'lowercase k'],
      ['14.625.621-K', 'uppercase K'],
      ['  12.345.678-5  ', 'surrounding whitespace (trimmed)'],
      ['12.345.678-5\n', 'trailing newline (trimmed)'],
      ['01234567-4', 'leading zero on a 7-digit body'],
      ['012.345.678-5', 'leading zero, dotted'],
      ['0012345678', 'leading zeros, compact'],
      ['123.456.789-5', '9-digit body, dotted'],
      ['100000000-7', '9-digit body, hyphen'],
      ['999999-K', '6-digit body'],
      ['12.345.6785', 'dotted without hyphen'],
      ['12.345678-5', 'non-canonical grouping'],
      ['12345.678-5', 'non-canonical grouping'],
      ['12 345 678-5', 'internal spaces'],
      ['12345678--5', 'double hyphen'],
      ['K2345678-5', 'K in the body'],
      ['１２３４５６７８-5', 'fullwidth digits'],
      ['١٢٣٤٥٦٧٨-5', 'Arabic-Indic digits'],
      ['', 'empty'],
      ['   ', 'whitespace only'],
    ])('%p (%s)', (input) => {
      expectAgreement(input)
    })

    test('every string up to 9 chars over a reduced alphabet', () => {
      // Exhaustive, not sampled: 2.4M strings covering every compact and
      // hyphen boundary (lengths, leading zero, K placement, stray separators).
      const alphabet = ['0', '1', 'K', '-', '.']
      let mismatches = 0
      const walk = (prefix: string, left: number) => {
        const accepted = isRutLike(prefix)
        if (re.any.test(prefix) !== accepted) mismatches++
        for (const shape of SHAPES) {
          if (re[shape].test(prefix) !== (accepted && shapeOf(prefix) === shape)) mismatches++
        }
        if (left === 0) return
        for (const char of alphabet) walk(prefix + char, left - 1)
      }
      walk('', 9)
      expect(mismatches).toBe(0)
    })

    test('property: mutated RUTs agree (insertions, deletions, replacements)', () => {
      const noise = [...'0123456789kK-. \t\n,_/aX', ' ', '﻿', '١', '１']
      const mutation = fc.tuple(fc.nat(13), fc.constantFrom('insert', 'delete', 'replace'), fc.constantFrom(...noise))
      const mutated = fc
        .tuple(
          fc.constantFrom(7, 8),
          fc.constantFrom('dotted', 'compact', 'hyphen'),
          fc.array(mutation, { maxLength: 3 }),
        )
        .map(([bodyLength, format, mutations]) => {
          let value: string = generate({ bodyLength: bodyLength as 7 | 8, format: format as 'dotted' })
          for (const [at, kind, char] of mutations) {
            const i = Math.min(at, value.length)
            if (kind === 'insert') value = value.slice(0, i) + char + value.slice(i)
            else if (kind === 'delete') value = value.slice(0, i) + value.slice(i + 1)
            else value = value.slice(0, i) + char + value.slice(i + 1)
          }
          return value
        })
      fc.assert(
        fc.property(mutated, (input) => {
          expectAgreement(input)
        }),
        { numRuns: 2000 },
      )
    })

    test('everything generate() produces matches its own pattern', () => {
      for (const format of ['compact', 'hyphen', 'dotted'] as const) {
        const shape = format
        for (const rut of generate({ format, count: 200 })) {
          expect([rut, re[shape].test(rut), re.any.test(rut)]).toEqual([rut, true, true])
        }
        for (const rut of generate({ format, bodyLength: 7, count: 200 })) {
          expect([rut, re[shape].test(rut), re.any.test(rut)]).toEqual([rut, true, true])
        }
      }
    })
  })

  describe('documented limits', () => {
    test('a pattern checks shape only, never the verifier digit', () => {
      expect(re.hyphen.test('12345678-0')).toBe(true)
      expect(validate('12345678-0')).toBe(false)
    })

    test('`any` and `compact` match any 9-digit number, such as a phone number', () => {
      expect(re.compact.test('912345678')).toBe(true)
      expect(re.any.test('912345678')).toBe(true)
      expect(re.hyphen.test('912345678')).toBe(false)
      expect(re.dotted.test('912345678')).toBe(false)
    })

    test('the 64-char input cap belongs to isRutLike(), not to the patterns', () => {
      // Past the cap the validator refuses to look at the input at all, while
      // the trimmed string still has a valid shape.
      const padded = ' '.repeat(60) + '12345678-5'
      expect(padded.length).toBeGreaterThan(64)
      expect(isRutLike(padded)).toBe(false)
      expect(re.any.test(padded.trim())).toBe(true)
    })
  })
})
