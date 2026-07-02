<div align="center">
  <img src="https://user-images.githubusercontent.com/12705403/158434864-7f13401a-b973-4267-b035-d9882cf6c545.png" alt="Rut.ts logo" width="100%">
  <h1>Rut.ts: Handle chilean RUT values with ease using TypeScript.</h1>

[![npm version](https://img.shields.io/npm/v/rut.ts?color=000&label=npm)](https://www.npmjs.com/package/rut.ts)
[![downloads](https://img.shields.io/npm/dm/rut.ts?color=000)](https://www.npmjs.com/package/rut.ts)
[![bundle size](https://deno.bundlejs.com/badge?q=rut.ts&treeshake=[*])](https://bundlejs.com/?q=rut.ts)
[![types included](https://img.shields.io/npm/types/rut.ts?color=000)](https://www.npmjs.com/package/rut.ts)
![zero dependencies](https://img.shields.io/badge/dependencies-0-000)
[![license](https://img.shields.io/npm/l/rut.ts?color=000)](./LICENSE)

</div>

The complete, security-hardened toolkit for the Chilean **RUT** (Rol Único
Tributario): validate, format, clean, decompose and generate — with a
correctness contract you can rely on in production.

- 🪶 **Tiny & zero-dependency** — tree-shakeable ESM, ships only what you import.
- 🔒 **Hardened by default** — bounded parsing, strict mode, generic errors. No ID values leak into logs or traces.
- 🧠 **Fully typed** — first-class TypeScript types, no `@types` package needed.
- 🌐 **Universal** — runs in Node (>= 18), the browser, Deno and Bun.
- ✅ **Battle-tested** — a differential harness guards every release against regressions.

## Installation

```bash
npm install rut.ts
# or: bun add rut.ts · pnpm add rut.ts · yarn add rut.ts
```

## Quick start

```typescript
import { parse, validate, format, clean, decompose, isRutLike } from 'rut.ts'

// Parse — the recommended entry point. Never throws; normalizes dirty/legacy
// input (zero padding, odd grouping, embedded garbage) and requires a valid
// Modulo 11 verifier.
const result = parse('0012345674') // e.g. a zero-padded fixed-width export
if (result.success) {
  result.rut //       '12345674'    — branded `Rut`, safe to persist
  result.formatted // '1.234.567-4' — canonical dotted rendering
  result.body //      '1234567'
  result.verifier //  '4'
}
parse('12345678-9').success // false (wrong verifier)
parse('0012345674', { canonicalOnly: true }).success // false (padding rejected)

// Validate — the strict canonical gate; strict mode also rejects placeholders
validate('12.345.678-5') // true
validate('12.345.678-0') // false (wrong verifier)
validate('11.111.111-1', { strict: true }) // false (suspicious)

// Format — accepts compact or formatted input
format('123456785') // '12.345.678-5'
format('123456785', { dots: false }) // '12345678-5'
format('123456789', { throwOnError: false }) // null (wrong verifier)

// Format progressively as the user types (great for form inputs)
format('1234', { incremental: true }) // '1.234'
format('123456785', { incremental: true }) // '12.345.678-5'

// Clean & decompose
clean('12.345.678-5') // '123456785'
decompose('12.345.678-5') // { body: '12345678', verifier: '5' }

// Cheap shape check, no full validation
isRutLike('12.345.678-5') // true

// The lower-level helpers throw InvalidRutError by default; pass
// { throwOnError: false } to get null instead — or just use parse().
format('abc', { throwOnError: false }) // null
```

### Branded types & typed errors

```typescript
import { isValidRut, InvalidRutError, mask, equals, generate } from 'rut.ts'
import type { Rut } from 'rut.ts'

// Type guard — narrows `unknown`/`string` to the branded `Rut`.
// (`parse()` is the other way to mint a `Rut`: its success branch carries one.)
function persist(value: string) {
  if (isValidRut(value)) {
    const rut: Rut = value // ✅ the type system knows it was validated
  }
}

// Typed errors — branch on the class/code, never on message text
try {
  mask('not-a-rut') // any safe helper throws InvalidRutError in default mode
} catch (err) {
  if (err instanceof InvalidRutError) err.code // 'INVALID_RUT'
}

// Mask for safe logging, and compare across shapes
mask('12.345.678-5') // '12.***.***-5'
equals('12.345.678-5', '123456785') // true  (same valid RUT, different shapes)
equals('12345678-9', '12345678-9') // false (wrong verifier — not a RUT at all)
equals('12345678-9', '12345678-9', { requireValid: false }) // true (4.x-style shape comparison)

// Generation options
generate() // '29.561.896-5'  (8-digit dotted, default)
generate({ format: 'compact' }) // '233715913'
generate({ bodyLength: 7, format: 'hyphen' }) // '7788862-4'
generate({ count: 3 }) // ['…', '…', '…']
```

> 📚 Full guides and live examples: **[rut.arrowsw.com](https://rut.arrowsw.com/)**

## Features

- **Parsing** — `parse()` never throws: normalizes dirty/legacy input, requires a valid verifier, and returns a discriminated union carrying the branded `Rut` plus its canonical rendering.
- **Validation** — verifier check with bounded input parsing and an optional `strict` mode that rejects placeholder/repeated-digit RUTs.
- **Branded types** — `isValidRut()` (type guard) and `parse()` both mint the branded `Rut`, so "this string was validated" flows through the type system.
- **Typed errors** — `InvalidRutError` (with a stable `code`) instead of message-matching.
- **Formatting** — standardized output, with or without dots.
- **Incremental formatting** — progressive formatting as the user types, ideal for form inputs.
- **Masking** — `mask()` produces `12.***.***-5` for safe logging/display.
- **Comparison** — `equals()` answers "same RUT?" across different shapes, checking validity by default (`{ requireValid: false }` for pure shape comparison).
- **Cleaning** — permissively strip extraneous characters and leading zeros.
- **Decomposition** — split a RUT into its body and verifier digit.
- **Generation** — cryptographically-backed random valid RUTs, with `bodyLength`, `format` and `count` options.
- **Calculate verifier** — compute the verifier digit for a given body.
- **Format detection** — cheap `isRutLike` check without full validation.
- **Safe mode** — the lower-level helpers support `throwOnError: false` to return `null` instead of throwing (`parse()` makes this largely unnecessary).

<details>
<summary><strong>New to RUTs? What the format means</strong></summary>

<br>

The **RUT** (Rol Único Tributario) is the unique Chilean identification number
used for tax, legal identification, government services, and banking.

**Format**: `XX.XXX.XXX-Y`

- `X` = Body (7–8 digits)
- `Y` = Verifier digit (`0`–`9` or `K`)

**Example**: `12.345.678-5`

The verifier digit is derived from the body via the
[Modulo 11 algorithm](https://en.wikipedia.org/wiki/Rol_%C3%9Anico_Tributario),
which is what makes a RUT self-validating.

</details>

## Security & correctness

`rut.ts` treats RUT validation as an identity-security boundary, not just string
formatting. That posture is the point of the library:

- **`validate(input, { strict: true })` is the recommended acceptance gate** for identity-sensitive flows. It rejects malformed dot grouping, caps oversized inputs before parsing, rejects repeated-digit placeholders, and compares the verifier via Modulo 11.
- **Errors are generic** (`Invalid RUT input`) so Chilean ID values never end up echoed into logs, traces, or user-visible exceptions.
- **`clean()` is intentionally permissive** — useful for display/storage normalization, but it does _not_ prove the verifier is correct. Always `validate()` before accepting a RUT.

### Accepted input formats (the validation contract)

`validate()` and `isRutLike()` accept **only** these shapes (optionally with
surrounding whitespace, verifier `k`/`K` case-insensitive):

| Shape            | Example                       | Notes                                  |
| ---------------- | ----------------------------- | -------------------------------------- |
| Compact          | `123456785`                   | 7–8 digit body + verifier              |
| Compact + hyphen | `12345678-5`                  |                                        |
| Canonical dotted | `12.345.678-5`, `1.234.567-4` | Chilean grouping; the `-` is required  |

Anything else is rejected, **including leading-zero padding** (`012.345.678-5`,
`0012345678` — a canonical RUT has none, and padding forms an unbounded family
of strings for one RUT), **non-canonical dot grouping** that older versions
accepted (`12.345678-5`, `12345.678-5`, `1.2.3.4-5`), the dotted shape
**without its verifier hyphen** (`12.345.6785`), internal spaces, commas, and
any input longer than 64 chars.

> **Zero-padded data?** Leading zeros are rejected by `validate()` /
> `isValidRut()` / `isRutLike()`, but `clean()`, `format()` and `equals()` stay
> permissive and still strip them. If you ingest fixed-width/zero-padded values,
> use **`parse()`** — it normalizes and validates in one step (see below).

> The 64-char limit is a **security bound, not a format rule**. A real RUT is
> ~9 significant characters, so the cap never rejects a realistic RUT — it just
> refuses to _process_ implausibly long strings, neutralizing CPU/ReDoS-style
> abuse before any parsing runs.

> 💡 **Migrating a dataset?** Ingest through `parse()` (lenient by default), or
> sanity-check a representative sample with `npm run test:differential` (writes
> `tests/differential-report.md`, including a dedicated 4.1.0 → 5.0.0 section).
> `clean()` / `decompose()` stay permissive — never treat their output as
> "validated".

## Parsing dirty input

Legacy exports, mainframe fixed-width files, and copy-pasted values rarely
arrive canonical. `parse()` is the one blessed path for that data: it
normalizes like `clean()` — zero padding, odd grouping, embedded garbage,
lowercase `k` — and then **requires the Modulo 11 verifier to match**. It never
throws.

```typescript
import { parse } from 'rut.ts'

// A zero-padded value from a fixed-width export:
const result = parse('0012345674')
if (result.success) {
  result.rut //       '12345674'    — branded `Rut`
  result.formatted // '1.234.567-4' — always passes validate()
} else {
  result.error // InvalidRutError — constant message, the input never leaks into it
}

// Tighten as needed:
parse('0012345674', { canonicalOnly: true }) // failure — validate()'s shape contract
parse('11.111.111-1', { strict: true }) // failure — placeholder rejection
```

`validate()` deliberately has **no** relaxation flags: it stays a binary
canonical gate. When input might be messy, reach for `parse()` — not for a
looser validator.

## `equals()` vs `validate()` — which one?

| Question you're asking | Use |
| --- | --- |
| "Are these the same RUT?" (shape-agnostic, zero-padding tolerated) | `equals()` |
| "Is this string written as a valid canonical RUT?" (identity/uniqueness gate) | `validate()` / `isValidRut()` |

By default `equals` also checks validity — two strings with a wrong verifier
are *not* "the same RUT" because they are not RUTs
(`equals('12345678-9', '12345678-9')` → `false`). Pass
`{ requireValid: false }` for the pure shape comparison (useful when
deduplicating dirty datasets, where the same typo twice is still one entity).

**Intended asymmetry:** `equals('012345678-5', '12.345.678-5')` → `true` while
`validate('012345678-5')` → `false`. `equals` is a normalization operation — it
inherits `clean()`'s permissiveness (leading zeros, separators, case) and adds
only the verifier check. Requiring canonical shape would make it useless for
the very thing it exists for: comparing different shapes of the same RUT.

## Incremental formatting

`format(input, { incremental: true })` formats a RUT progressively as the user
types — ideal for real-time feedback in form fields.

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setRut(format(e.target.value, { incremental: true }))
}
```

**Use it for:** real-time input formatting and visual feedback.
**Don't use it for:** validating, or formatting already-complete/stored RUTs
(use `format()` / `validate()`). Incremental output may not be a valid RUT until
the input is complete — always `validate()` the final value.

## TypeScript types

```typescript
import type {
  DecomposedRut,
  EqualsOptions,
  FormatOptions,
  GenerateOptions,
  ParseOptions,
  ParseResult,
  Rut,
  SafeOptions,
  ValidateOptions,
  VerifierDigit,
} from 'rut.ts'

// VerifierDigit:  '0' | '1' | … | '9' | 'K'
// DecomposedRut:  { body: string; verifier: VerifierDigit }
// FormatOptions:  { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
// ValidateOptions:{ strict?: boolean }
// ParseOptions:   { strict?: boolean; canonicalOnly?: boolean }
// ParseResult:    { success: true; rut: Rut; body; verifier; formatted }
//               | { success: false; error: InvalidRutError }
// EqualsOptions:  { requireValid?: boolean }
// SafeOptions:    { throwOnError?: boolean }
// GenerateOptions:{ bodyLength?: 7 | 8; format?: 'dotted' | 'compact' | 'hyphen'; count?: number }
// Rut:            string & { /* brand */ }  — a validated RUT (from isValidRut or parse)
```

## Upgrading

`5.0.0` is the **final-shape** release: the `validate()` contract is frozen, and
no further breaking changes are planned. Coming from `4.x`, the two behavior
changes are leading-zero rejection in the predicates and the validity-checking
`equals` default — the [**CHANGELOG**](./CHANGELOG.md) has a before/after table
and migration notes for both (in short: ingest dirty data with `parse()`, and
pass `{ requireValid: false }` to `equals` for the old comparison).

## Contributing

Contributions are welcome — feel free to open issues for bugs and feature
requests, or submit a pull request.

## License

[MIT](./LICENSE) © rut.ts contributors
