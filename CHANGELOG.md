# Changelog

All notable changes to **rut.ts** are documented in this file.

This changelog starts at **v4.0.0**. Releases `3.4.0` and earlier predate this
file and were not formally tracked here. From this version onward, every release
documents its changes and—when applicable—its breaking changes.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-05-17

A **major, breaking** release that hardens the library for high-volume
RUT/RUN **identity validation in production**. The Modulo 11 algorithm itself
was already correct; this release hardens the input perimeter and tightens the
"clean / format / validate" contract. Upgrading from `3.x` requires reading the
**Breaking changes** section below.

### Why this is a major release

`3.x` accepted ambiguous input shapes, "repaired" RUTs with an incorrect
verifier digit when formatting, echoed the raw input into error messages, and
had a regex that was vulnerable to ReDoS on adversarial input. Fixing these
correctly changes observable behavior for some inputs, so per SemVer this is a
major version bump even though several items are security fixes.

### Security

- **ReDoS / unbounded input.** `validate()` and `isRutLike()` previously ran an
  ambiguous regex (`/^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/`) **before any length
  check**. Adversarial input exhibited catastrophic backtracking
  (`"0".repeat(16000) + "x"` ≈ **353 ms**; growing super-linearly), and
  `isRutLike("1".repeat(50000))` returned `true`. Inputs are now length-capped
  (`MAX_RUT_INPUT_LENGTH = 64`) **before** any regex work, and matched against
  bounded, non-ambiguous shape patterns (compact / compact-with-hyphen /
  canonical-dotted). Adversarial input is now rejected in well under 1 ms.
- **`strict` bypass with uppercase `K`.**
  `validate('8.888.888-K', { strict: true })` incorrectly returned `true`
  because the suspicious-pattern regex only matched lowercase `k`. Suspicious
  detection now runs on the normalized, uppercased body and is case-safe.
- **PII in error messages.** `getInvalidRutError()` echoed the full RUT into the
  thrown message, which leaked Chilean ID values into logs, traces, and alerts.
  The message is now the constant `Invalid RUT input`.

### Changed (Breaking)

1. **`format()` no longer "repairs" an incorrect verifier digit.** In
   non-incremental mode it now validates the verifier (Modulo 11) and returns
   `null` (safe mode) or throws (default). Previously
   `format('123456789')` returned `'12.345.678-9'` despite a wrong verifier;
   it now returns `null` / throws. Inputs with an invalid verifier such as
   `'1234567K'` are likewise rejected.
2. **`validate()` / `isRutLike()` reject non-canonical dot grouping.** Only
   three shapes are accepted (optionally with leading zeros and surrounding
   whitespace; verifier `k`/`K` is case-insensitive):
   - compact — `123456785`
   - compact + hyphen — `12345678-5`
   - canonical dotted — `12.345.678-5`, `1.234.567-4`

   Shapes accepted by `3.x` but **now rejected**: `12.345678-5`,
   `12345.678-5`, `1.2.3.4.5.6.7.8-5`, internal spaces (`12 345 678 5`), any
   input longer than 64 characters.
3. **`validate()` / `isRutLike()` now `trim()` the input.** Surrounding
   whitespace is tolerated (`'  12.345.678-5  '` → `true`). This is a
   relaxation but is still a behavior change.
4. **Generic error messages.** Every thrown error is now exactly
   `Error: Invalid RUT input`. Any code matching on the previous
   `String "<rut>" is not valid as a RUT input` text will no longer match.
5. **`getInvalidRutError` signature changed** from `(rut: string) => string` to
   `(_rut?: unknown) => string` and always returns the constant message. This
   helper is part of the exported API.
6. **Safe mode is now safe for non-string callers.** `clean()`, `format()`,
   `calculateVerifier()`, `getBody()`, `getVerifier()`, and `decompose()`
   previously threw a `TypeError` on non-string input (number, `null`,
   `undefined`, object). They now honor `throwOnError`: returning `null` in
   safe mode and throwing the generic `Invalid RUT input` error otherwise.
7. **Incremental `format()` is capped at the maximum RUT length.** Input is
   bounded to 64 chars before normalization and the significant value is capped
   to 9 chars. `format('12345678901234', { incremental: true })` changed from
   `'1.234.567.890.123-4'` to `'12.345.678-9'`. A trailing `K` is preserved
   only while the value still fits in 9 chars; beyond the cap the first 9
   digits are kept and the `K` is dropped. Incremental mode is for live-typing
   display only — final values must still be checked with `validate()`.

### Fixed

- **`generate()` range bug.** The previous range
  `Math.floor(10000003 + Math.random() * 90000000)` could emit 9-digit bodies
  that `calculateVerifier()` rejected (producing an occasional throw). The
  range is now a correct inclusive `10000000–99999999`.
- **`generate()` could emit repeated-digit placeholders.** It now skips
  all-same-digit bodies, so generated RUTs also pass `validate(_, { strict:
  true })`.

### Added

- **CSPRNG-backed `generate()`.** Uses Web Crypto (`crypto.getRandomValues`)
  with unbiased rejection sampling when available, falling back to
  `Math.random()` on older runtimes.
- **Verifier hot-path optimization.** The Modulo 11 sum is computed with a
  reverse `charCodeAt` loop instead of `split('').reverse().reduce()`,
  removing two array allocations per call. Measured throughput on the new
  `validate()`: ~9M validations/second (1M mixed inputs in ~110 ms).
- **`CHANGELOG.md`** (this file).
- **`tests/differential.test.ts`** — a reproducible (seeded) differential
  harness (`npm run test:differential`) that runs the `3.x` and `4.0.0`
  `validate()` over a large stratified corpus (default 1,000,000 cases) and
  writes `tests/differential-report.md` listing every input whose result
  changed, grouped by input shape. Use it to characterize impact on a real
  dataset before upgrading.
- New regression tests: bounded/adversarial input, the `strict` uppercase-`K`
  bypass, non-string safe mode for every helper, `format()` verifier rejection,
  and the incremental capping / trailing-`K` edge.

### Internal

- Removed a dead length re-check in `parseRutLike()`: after
  `isBoundedString()` (which caps the raw length at 64) the post-`trim()`
  `length > MAX_RUT_INPUT_LENGTH` branch was unreachable, since `trim()` can
  only shrink the string. Only the whitespace-only (`length === 0`) case
  remains. No behavior change.

### Migration guide (3.x → 4.0.0)

- **Validation gate:** use `validate(input, { strict: true })` as the
  acceptance check. Do **not** treat the output of `clean()` / `decompose()` as
  proof of validity — they remain intentionally permissive normalizers.
- **Non-canonical input:** if your data source emits RUTs in a shape other than
  the three accepted ones, normalize it first, or run
  `npm run test:differential` against a representative sample to get the exact
  list of values whose result changes.
- **`format()` for display of arbitrary numbers:** if you relied on `format()`
  to "fix" arbitrary 8–9 digit numbers, note it now requires a correct
  verifier in non-incremental mode. Use `incremental: true` for
  display-as-you-type, and `validate()` for acceptance.
- **Error handling:** stop matching on error message text; switch to
  `throwOnError: false` and check for `null`.

[4.0.0]: https://github.com/arrowsw/rut.ts/releases/tag/v4.0.0
