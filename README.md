<div align="center">
  <img src="https://user-images.githubusercontent.com/12705403/158434864-7f13401a-b973-4267-b035-d9882cf6c545.png" alt="Rut.ts logo" width="100%">
  <h1>Rut.ts: Handle chilean RUT values with ease using TypeScript.</h1>
</div>

![Open Bundle](https://deno.bundlejs.com/badge?q=rut.ts@4.0.0)

> **v4.0.0 is a major, breaking release** focused on production identity hardening.
> Read the [CHANGELOG](./CHANGELOG.md) before upgrading from `3.x`.

## What is a RUT?

The **RUT** (Rol Único Tributario) is the unique Chilean identification number used for:

- Tax purposes
- Legal identification
- Government services
- Banking and financial transactions

**Format**: `XX.XXX.XXX-Y` where:

- `X` = Body (7-8 digits)
- `Y` = Verifier digit (0-9 or K)

**Example**: `12.345.678-5`

The verifier digit is calculated using the [Modulo 11 algorithm](https://en.wikipedia.org/wiki/Rol_%C3%9Anico_Tributario) to validate the RUT's authenticity.

---

## Features

- **Validation**: Check if a RUT is valid with bounded input parsing, verifier validation, and optional strict mode.
- **Cleaning**: Permissively remove extraneous characters and leading zeros from RUT strings.
- **Formatting**: Convert valid RUTs into a standardized format, with or without dots.
- **Incremental Formatting**: Format RUTs progressively as the user types (ideal for form inputs).
- **Decomposition**: Split a RUT into its body and verifier digit.
- **Generation**: Generate valid random RUT numbers for testing, using Web Crypto when available.
- **Calculate Verifier**: Calculate the verifier digit for a given RUT body.
- **Format Detection**: Check if a bounded string looks like a RUT format with `isRutLike`.
- **Safe Mode**: All safe functions support `throwOnError: false` to return `null` instead of throwing generic errors.

## Installation

Using [bun](https://bun.sh/):

    $ bun add rut.ts

Using [npm](https://www.npmjs.com/):

    $ npm install rut.ts

Using [pnpm](https://pnpm.io/):

    $ pnpm install rut.ts

## Quick Examples

```typescript
import { validate, format, clean, isRutLike, decompose } from 'rut.ts'

// Validation
validate('12.345.678-5') // true
validate('12.345.678-0') // false (wrong verifier)
validate('11.111.111-1', { strict: true }) // false (strict mode rejects suspicious RUTs)
validate('8.888.888-K', { strict: true }) // false (uppercase K suspicious RUT)

// Formatting
format('123456785') // '12.345.678-5'
format('123456785', { dots: false }) // '12345678-5'
format('123456789', { throwOnError: false }) // null (wrong verifier)

// Incremental formatting (for form inputs)
format('1234', { incremental: true }) // '1.234'
format('12345678', { incremental: true }) // '1.234.567-8' (8 chars = complete)
format('123456785', { incremental: true }) // '12.345.678-5' (9 chars = complete)

// Cleaning
clean('12.345.678-5') // '123456785'
// clean() normalizes shape only. Use validate() before accepting a RUT.

// Decomposition
const { body, verifier } = decompose('12.345.678-5')
console.log(body) // '12345678'
console.log(verifier) // '5'

// Format detection (without full validation)
isRutLike('12.345.678-5') // true
isRutLike('not-a-rut') // false

// Safe mode (returns null instead of throwing)
clean('invalid', { throwOnError: false }) // null
format('abc', { throwOnError: false }) // null
```

## Incremental Formatting

The `incremental` option in `format()` allows you to format RUTs progressively as the user types. This is useful for real-time formatting in form inputs.

```typescript
// Example: React input handler
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const formatted = format(e.target.value, { incremental: true })
  setRut(formatted)
}
```

> **Note**: Incremental formatting will format the input progressively even for incomplete RUTs. The formatted output may not represent a valid RUT until the input is complete. Always use `validate()` to verify the final RUT before processing.

## Production Validation Notes

For security-sensitive identity flows, prefer `validate(input, { strict: true })` as the acceptance gate. The validator now rejects malformed dot grouping, caps oversized inputs before parsing, rejects repeated-digit placeholders in strict mode, and compares the verifier digit using the Modulo 11 algorithm.

`clean()` remains intentionally permissive for input normalization. It is useful before display or storage, but it does not prove that the verifier digit is correct. `format()` validates the verifier digit in non-incremental mode and returns `null` in safe mode for invalid complete RUTs.

Error messages are generic (`Invalid RUT input`) so invalid Chilean ID values are not echoed into logs, traces, or user-visible exceptions.

### Accepted input formats (the validation contract)

`validate()` and `isRutLike()` accept **only** these shapes (optionally with leading
zeros and surrounding whitespace, verifier `k`/`K` case-insensitive):

| Shape | Example | Notes |
|-------|---------|-------|
| Compact | `123456785` | 7–8 digit body + verifier |
| Compact + hyphen | `12345678-5` | |
| Canonical dotted | `12.345.678-5`, `1.234.567-4` | Chilean grouping from the right |

Anything else is rejected, **including non-canonical dot grouping** that older
versions accepted: `12.345678-5`, `12345.678-5`, `1.2.3.4.5.6.7.8-5`,
internal spaces (`12 345 678 5`), commas, and any input longer than 64 chars.

> ⚠️ **Migrating a large dataset?** If your upstream emits RUTs in a non-canonical
> shape, normalize it to one of the three accepted forms **before** calling
> `validate()`, or run the differential harness against a representative sample
> first: `npm run test:differential` (see
> [`tests/differential.test.ts`](./tests/differential.test.ts); it writes
> `tests/differential-report.md`). `clean()`/`decompose()` stay permissive and
> will still parse some of those shapes — never treat their output as
> "validated".

### When to use incremental mode

**✅ Use incremental when:**

- Formatting user input in real-time as they type
- Providing immediate visual feedback in form fields
- Improving UX with progressive formatting

**❌ Don't use incremental when:**

- Formatting already complete/stored RUTs (use default `format()`)
- Validating RUTs (use `validate()` instead)
- Processing final form submission values

## Usage

Please refer to [the documentation](https://rut.arrowsw.com/) for more detailed examples.

## TypeScript Types

The library exports the following types:

```typescript
import type { DecomposedRut, FormatOptions, SafeOptions, ValidateOptions, VerifierDigit } from 'rut.ts'

// VerifierDigit: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'
// DecomposedRut: { body: string; verifier: string }
// FormatOptions: { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
// ValidateOptions: { strict?: boolean }
// SafeOptions: { throwOnError?: boolean }
```

## Contributing

Contributions to this library are welcome. Please feel free to submit pull requests or create issues for bugs and feature requests.
