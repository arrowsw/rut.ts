import fc from 'fast-check'

import {
  calculateVerifier,
  clean,
  decompose,
  equals,
  format,
  isRutLike,
  isValidRut,
  mask,
  parseRut,
  validate,
} from '../src'

/**
 * Property-based tests (fast-check). These complement the hand-written
 * Monte-Carlo loops in generate.test.ts: fast-check explores the input space
 * with shrinking, so a counter-example is reported as a minimal failing case.
 *
 * `numRuns` is kept modest so the suite stays fast under plain `npm test`.
 */
const RUNS = { numRuns: 300 }

// A body that the library accepts (7- or 8-digit, no leading zeros).
const validBody = fc.integer({ min: 1_000_000, max: 99_999_999 }).map(String)

// A valid RUT rendered in one of the three accepted shapes.
const validRut = fc.tuple(validBody, fc.constantFrom('compact', 'hyphen', 'dotted')).map(([body, shape]) => {
  const compact = body + calculateVerifier(body)
  if (shape === 'compact') return compact
  if (shape === 'hyphen') return format(compact, { dots: false })
  return format(compact)
})

describe('property: validity', () => {
  test('a body + its computed verifier always validates (compact, hyphen, dotted)', () => {
    fc.assert(
      fc.property(validBody, (body) => {
        const dv = calculateVerifier(body)
        const compact = `${body}${dv}`
        return validate(compact) && validate(format(compact)) && validate(format(compact, { dots: false }))
      }),
      RUNS,
    )
  })

  test('the canonical form of any valid RUT re-validates', () => {
    fc.assert(
      fc.property(validRut, (rut) => validate(format(rut))),
      RUNS,
    )
  })
})

describe('property: idempotence', () => {
  test('clean(clean(x)) === clean(x)', () => {
    fc.assert(
      fc.property(validRut, (rut) => {
        const once = clean(rut)
        return clean(once) === once
      }),
      RUNS,
    )
  })

  test('format(format(x)) === format(x)', () => {
    fc.assert(
      fc.property(validRut, (rut) => {
        const once = format(rut)
        return format(once) === once
      }),
      RUNS,
    )
  })
})

describe('property: round-trips', () => {
  test('decompose ∘ format reconstructs the cleaned RUT (body + verifier === clean)', () => {
    fc.assert(
      fc.property(validRut, (rut) => {
        const { body, verifier } = decompose(format(rut))
        return body + verifier === clean(rut)
      }),
      RUNS,
    )
  })

  test('all three shapes of the same RUT clean to the same value', () => {
    fc.assert(
      fc.property(validBody, (body) => {
        const compact = `${body}${calculateVerifier(body)}`
        const a = clean(compact)
        const b = clean(format(compact))
        const c = clean(format(compact, { dots: false }))
        return a === b && b === c
      }),
      RUNS,
    )
  })
})

describe('property: parseRut / isValidRut', () => {
  test('parseRut success ⟹ the returned rut validates and isValidRut agrees', () => {
    fc.assert(
      fc.property(validRut, (rut) => {
        const result = parseRut(rut)
        return result.success && validate(result.rut) && isValidRut(result.rut)
      }),
      RUNS,
    )
  })

  test('parseRut and isValidRut agree with validate on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const expected = validate(s)
        return parseRut(s).success === expected && isValidRut(s) === expected
      }),
      RUNS,
    )
  })
})

describe('property: equals / mask', () => {
  test('equals is true across every shape of the same RUT', () => {
    fc.assert(
      fc.property(validBody, (body) => {
        const compact = `${body}${calculateVerifier(body)}`
        return equals(compact, format(compact)) && equals(format(compact), format(compact, { dots: false }))
      }),
      RUNS,
    )
  })

  test('mask keeps head + verifier and hides the middle groups', () => {
    fc.assert(
      fc.property(validRut, (rut) => {
        const masked = mask(rut)
        const { body, verifier } = decompose(rut)
        const head = body.slice(0, body.length - 6)
        const middle = body.slice(body.length - 6)
        return masked === `${head}.***.***-${verifier}` && !masked.includes(middle)
      }),
      RUNS,
    )
  })
})

describe('property: safety on arbitrary input', () => {
  test('validate / isRutLike never throw and always return a boolean for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => typeof validate(s) === 'boolean' && typeof isRutLike(s) === 'boolean'),
      RUNS,
    )
  })

  test('validate is bounded even on long adversarial strings (no catastrophic backtracking)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (n) => {
        const adversarial = '0'.repeat(n) + 'x'
        const start = performance.now()
        validate(adversarial)
        return performance.now() - start < 25
      }),
      { numRuns: 50 },
    )
  })
})
