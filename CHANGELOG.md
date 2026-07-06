# Changelog

All notable changes to **rut.ts** are documented in this file.

From **v4.0.0** onward, every release documents its changes here in full
and—when applicable—its breaking changes. Entries for `3.4.0` and earlier
predate this file and are **reconstructed from git history and npm publish
metadata**: they are accurate but summarized, not exhaustive.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - 2026-07-06

The **final-shape** major. `5.0.0` closes the validation contract
(leading-zero padding is rejected by the acceptance predicates), makes
`equals()` answer the question its name asks (validity is now checked by
default), and drops the v3-era dead weight. The Modulo 11 algorithm is
**unchanged** throughout.

### API stability commitment

**This is the release after which the contract freezes.** After three majors in
about a year, no further breaking changes are planned: the `validate()`
acceptance contract (three canonical shapes, no leading zeros, 64-char cap) is
final, and the `throwOnError: true` defaults of the safe helpers **will not
change until a hypothetical v6** — which is not planned. Any new capability
will arrive as an addition in a minor release, never as a mutation of existing
behavior.

### Why

A canonical Chilean RUT body never carries leading zeros — `12.345.678-5`, never
`012.345.678-5`. Leading zeros only ever appear as a fixed-width storage
artifact. Unlike the three accepted shapes (which differ only in *separators*
over the same digits), padding forms an **unbounded** family of distinct strings
for one RUT (`12345678` = `012345678` = `0012345678` = …). Accepting them let a
zero-padded variant slip past a strict uniqueness/identity gate — the exact class
of bug the strict acceptance path exists to prevent. `4.x` silently stripped the
zeros and returned `true`; `5.0.0` refuses the input instead, and points you at
`clean()` to normalize it explicitly.

### Do I need to change anything?

**For most projects, no.** If you validate normally-formatted RUTs — compact
(`123456785`), compact + hyphen (`12345678-5`) or canonical dotted
(`12.345.678-5`) — and treat `equals()` as "same RUT?", nothing changes. You
need to act only if:

1. you feed **zero-padded** values (fixed-width exports from legacy/mainframe
   systems) directly into `validate()` / `isValidRut()` / `isRutLike()`,
2. you relied on `equals()` matching **invalid** RUT-shaped strings (dirty-data
   dedup), or
3. you still call the long-deprecated `getInvalidRutError()`, or run Node < 20.

### Upgrade notes

- **Ingest dirty/legacy input with the two-line recipe — normalize first, then
  validate the normalized value:**

  ```ts
  const rut = clean(raw, { throwOnError: false }) // '0012345674' → '12345674' | null
  if (rut !== null && validate(rut)) db.save(rut) // canonical, Modulo 11 verified
  ```

  This is the blessed path for zero-padded fixed-width exports and other messy
  sources: `clean()` collapses the unbounded zero-padded family into one
  canonical string, and `validate()` then proves the verifier. Never store
  `clean()`'s output without the `validate()` step — `clean` does not check the
  Modulo 11 digit.

  Deliberate **non-goal**: no `allowLeadingZeros`-style relaxation flag was (or
  will be) added to `validate()` — every flag that relaxes the canonical
  contract erodes exactly the guarantee it exists to give. `validate` stays a
  binary, flag-free (except `strict`) identity gate; messy input gets
  normalized *before* the gate, never waved through it.
- **Dedup of dirty datasets:** pass `{ requireValid: false }` to `equals` to
  keep the 4.x behavior (same typo in two rows → still the same entity).
- **`getInvalidRutError()` callers:** catch `InvalidRutError` or check
  `err.code === 'INVALID_RUT'` instead.
- **Size the impact on a real dataset** with the differential harness:
  `npm run test:differential` writes `tests/differential-report.md`, which now
  carries a dedicated **4.1.0 → 5.0.0** section: the only `validate` regressions
  are the zero-padded shapes, and the only `equals` divergences are wrong-DV
  pairs.

### Added

- **`EqualsOptions`** exported type (`{ requireValid?: boolean }`) for the new
  `equals` option described below.

### Changed (Breaking)

- **`validate()`, `isValidRut()` and `isRutLike()` reject leading-zero padding.**
  Any input whose first (trimmed) character is `0` now returns `false`:
  `validate('012.345.678-5')`, `validate('0012345678')` and
  `isRutLike('00012345678')` are all `false` (were `true` in `4.x`). The guard
  lives in the shared `parseRutLike` parser, so the three predicates move
  together. It is a runtime check on the parsed input, **not** merely the removal
  of the `0*` prefix from the shape patterns: a single zero on a 7-digit body
  (`01234567-4`) is absorbed by `\d{7,8}` and would otherwise be stripped during
  normalization, so the patterns alone could not close the gap.

- **`equals()` now checks validity by default (`requireValid: true`).**
  `equals` answers *"are these the same RUT?"* — and two strings that are not
  RUTs cannot be the same RUT. By default both arguments must normalize to the
  same value **and** that value must pass Modulo 11:

  | Call | 4.1.0 | 5.0.0 | Why |
  | ---- | ----- | ----- | --- |
  | `equals('12345678-9', '12345678-9')` | `true` | **`false`** | wrong verifier — not a RUT |
  | `equals('12.345.678-9', '123456789')` | `true` | **`false`** | same wrong-verifier value across shapes |
  | `equals('012345678-5', '12.345.678-5')` | `true` | `true` | valid after normalization (see below) |
  | `equals('12.345.678-5', '123456785')` | `true` | `true` | valid, same RUT |
  | `equals(a, b, { requireValid: false })` | n/a | 4.1.0 behavior | pure normalization comparison |

  **Coherence rule (intended asymmetry):** validity is checked against the
  *normalized* value, not against `validate()`'s canonical shape contract —
  `equals('012345678-5', '12.345.678-5')` stays `true` even though
  `validate('012345678-5')` is `false`. `equals` is a normalization operation by
  definition; `requireValid` adds exactly one thing (the verifier check), because
  requiring canonical shape would make `equals` useless for the very thing it
  exists for: comparing different shapes of the same RUT. This is not a bug.

  `{ requireValid: false }` preserves the 4.x comparison byte-for-byte — the
  legitimate use case is deduplicating dirty datasets, where the same typo in two
  rows is still the same entity. The differential harness proves the parity on a
  50k-pair corpus.

- **Node.js >= 20 required (`engines`).** Node 14–18 are past end-of-life, and
  20 is the first floor that guarantees `globalThis.crypto` (a default global
  since Node 19) — it also matches the versions CI actually tests. The
  `Math.random` fallback in `generate()` is retained purely as a safety net for
  exotic embedded runtimes and its JSDoc now says so (generated RUTs are test
  fixtures, not secrets).

### Removed

- **`getInvalidRutError()`** (deprecated since 4.1.0). It was a v3-era shim that
  always returned the constant string `Invalid RUT input`. Migration: catch
  `InvalidRutError` (`err instanceof InvalidRutError`) or branch on
  `err.code === 'INVALID_RUT'`; the constant message is
  `new InvalidRutError().message` if you truly need the text.

### Unchanged

- **The lenient normalizers stay permissive.** `clean()`, `format()`,
  `decompose()`, `getBody()`, `getVerifier()`, `mask()` and `calculateVerifier()`
  continue to strip leading zeros — they are normalization / recovery tools, not
  validation. The split is deliberate: `validate*` answers "is this written as a
  canonical RUT?"; `clean` / `format` answer "recover a RUT from messy input";
  the two compose into the ingestion recipe above. `clean()`'s docs now spell
  out that it strips *every* non-`[0-9kK]` character wherever it sits —
  `clean('RUT: 12.345.678-5')` → `'123456785'` — by design, for its
  paste-normalizer role.
- **`throwOnError` defaults are untouched.** The seven safe helpers
  (`clean`, `format`, `decompose`, `getBody`, `getVerifier`, `calculateVerifier`,
  `mask`) still throw `InvalidRutError` by default and still accept
  `{ throwOnError: false }`. Flipping that default was evaluated and rejected:
  TypeScript consumers would get self-discovering compile errors, but plain
  JavaScript consumers would get a **silent** behavior change (`throw` → `null`)
  that propagates noiselessly downstream — the worst class of breaking change.
  These defaults will not change until a hypothetical v6.
- **Modulo 11, strict mode, the 64-char security cap, and the generic
  `Invalid RUT input` error are all untouched.**

### Internal

- **The internal parser was restructured into a single typed core.** One typed
  splitter is now shared by a lenient core (used by `clean` / `decompose` /
  `getBody` / `getVerifier` / `mask` / `format`) and a canonical core (used by
  `validate` / `isValidRut` / `isRutLike`). `decompose`'s unreachable defensive
  re-narrowing branch — a long-standing surviving Stryker mutant — is gone
  *structurally*, not via ignore-comment. Same regex budget on the `validate`
  hot path; no perf regression.
- `parseRutLike` gains the leading-zero guard; the now-redundant `0*` prefix was
  dropped from the `compact` / `compactWithHyphen` / `dotted` shape patterns to
  document the intent at the grammar level.
- **The differential harness now carries a frozen `v4.1.0` baseline** (verbatim
  `validate` + `equals` from the v4.1.0 tag) alongside the existing `v3.4.0`
  one — real upgraders of this major come from 4.x. The regenerated
  `tests/differential-report.md` shows: 4.1.0 → 5.0.0 `validate` regressions are
  **exactly** the zero-padded shapes (50 001 of 1 000 000 inputs; zero new
  acceptances), `equals` diverges **only** on wrong-verifier pairs, and
  `equals(a, b, { requireValid: false })` matches 4.1.0 on **every** one of the
  50 004 comparison pairs. Same reproducible seed; the `random-digits` stratum
  still never emits leading-zero strings, so the catch-all only ever reports a
  *real* surprise.
- **New property-based laws** (fast-check) pin the 5.0.0 API coherence: the
  ingestion recipe accepts every zero-padded rendering of a valid RUT (and
  never a wrong verifier, however padded); recipe acceptance coincides with
  default-`equals` reflexivity; `equals(clean(a), a)` for every valid `a`;
  `equals` symmetry in both modes.
- Test suite updated accordingly (**523 tests** across 16 suites).

## [4.1.0] - 2026-06-13

A **feature** release that broadens the API and hardens the build, packaging, CI
and test suite — **without touching the Modulo 11 algorithm**. Existing code
keeps working; every addition is backward compatible. The single behavior change
is a **bug fix** that brings `validate()` in line with the input contract
`4.0.0` already documented.

### Upgrade notes

- **Most projects need no changes.** `validate`, `format`, `clean`, `decompose`
  and `generate()` behave exactly as before for the three documented shapes.
- **One stricter case:** `validate('12.345.6785')` / `isRutLike('12.345.6785')`
  (canonical dot grouping but **no verifier hyphen**) now return `false`. That
  shape was never documented as valid; if a dataset stored it, insert the `-`
  before the verifier (or strip the dots to the compact form) first. See
  [Fixed](#fixed).
- **TypeScript only:** `DecomposedRut.verifier` narrows from `string` to
  `VerifierDigit`. Reading the value is unaffected — only code that *constructs*
  a `DecomposedRut` by hand may need the narrower type.

### Added

- **`InvalidRutError`** — a typed error (exported class) thrown by the safe
  helpers in their default mode. Branch on `err instanceof InvalidRutError` or
  `err.code === 'INVALID_RUT'` instead of matching the message text. The message
  is still the constant `Invalid RUT input`, so the anti-PII guarantee holds.
  `getInvalidRutError` is now `@deprecated` in its favor.
- **`isValidRut(input, options?): input is Rut`** — a type guard that narrows a
  value to the new exported branded **`Rut`** type, letting "this string was
  validated" flow through the type system.
- **`mask(rut, options?)`** — masks a RUT for safe logging/display, keeping only
  the leading group and verifier: `12.345.678-5` → `12.***.***-5`.
- **`equals(a, b)`** — normalized RUT comparison, so different shapes of the same
  RUT match: `equals('12.345.678-5', '123456785')` → `true`.
- **`generate()` options** — `{ bodyLength?: 7 | 8, format?: 'dotted' | 'compact'
  | 'hyphen', count?: number }`. `count` returns an array; `bodyLength: 7` now
  produces real 7-digit RUTs. `generate()` with no arguments is unchanged.
- **Source maps are now published** (`*.min.js.map`) alongside the original
  `src/*.ts`, so consumers can debug and audit the shipped minified code against
  the original source.

### Changed

- **`DecomposedRut.verifier` is now `VerifierDigit`** (was `string`), matching
  what `getVerifier()` already returned. This narrows the type; code that reads
  the value is unaffected, code that constructs the object by hand may need the
  narrower type (semver-minor).
- **`decompose()` is single-pass.** It now calls `clean()` once instead of
  `getBody()` + `getVerifier()` (which each re-ran `clean()`), halving the
  parsing work and dropping the dead `verifier === null` branch.
- **Build target raised to ES2020.** The previous `ES6` target down-levelled
  `?.`/`??` into verbose ternaries; native ES2020 syntax is ~6.5% smaller
  minified and parses faster (it partly offsets the size of the new APIs above;
  the published bundle measures ~3.96 kB min / ~1.66 kB gzip per bundlejs). `engines.node` is now
  declared as `>=14` (Web Crypto in `generate()` stays optional via the
  `Math.random` fallback). Dropped the `importHelpers` option (no `tslib`
  runtime dependency could ever be required) and the stray `jsx`/`lib: ["dom"]`
  settings.
- **Richer package metadata** for discoverability and tooling: `homepage`,
  `bugs`, `engines`, expanded `keywords`, and a `"./package.json"` entry in
  `exports`.

### Fixed

- **`validate()` / `isRutLike()` now require the hyphen in the dotted shape.**
  An optional hyphen in the dotted pattern (`…\.\d{3}-?[\dkK]`) accepted a
  fourth, undocumented shape — dotted digits with the verifier glued onto the
  last group, e.g. `12.345.6785` — even though the `4.0.0` contract (README,
  `llms.txt`, this changelog) only ever listed `12.345.678-5`.
  `validate('12.345.6785')` and `isRutLike('12.345.6785')` now correctly return
  `false`. The three documented shapes — compact (`123456785`), compact + hyphen
  (`12345678-5`) and canonical dotted (`12.345.678-5`) — are unaffected. If a
  dataset somehow stored the dotted no-hyphen shape, normalize it (insert the
  `-` before the verifier, or strip the dots to compact) before validating.
- **`llms.txt` is now published in the npm tarball.** It had been silently
  excluded: when `package.json` declares a `files` allowlist it takes
  precedence over `.npmignore`, so the `!llms.txt` rule never applied. `llms.txt`
  was added to `files` and the now-redundant `.npmignore` removed, leaving a
  single source of truth for what ships.

### Internal

- The gated 1,000,000-case differential corpus no longer runs during a plain
  `npm test`. Jest executes the body of a `describe.skip` block at collection
  time, so the full run — and its `tests/differential-report.md` write — fired
  on every invocation, dirtying the working tree. It now runs inside `beforeAll`,
  gated behind `RUN_DIFFERENTIAL=1` as designed. `npm test` only pays the 1k
  mini-corpus.
- **Coverage is now enforced.** `jest.config.cjs` measures `src/**/*.ts` (never
  the built `dist`) with a regression-ratchet `coverageThreshold`, and the
  `testRegex`/`transform` were tightened to `.ts`/`.js` only.
- **CI hardening.** Added Node 24 to the test matrix, Deno and Bun smoke jobs
  that import the real ESM build (backing the "runs in Deno and Bun" claim), a
  `size-limit` bundle guard, a coverage job, a tag-triggered publish workflow
  with npm provenance, and a `SECURITY.md` disclosure policy.
- **Deeper verification.** Added property-based tests (fast-check) for the core
  invariants and a Stryker mutation-testing setup (`npm run mutation`, run
  periodically rather than in CI) — the Modulo 11 hot path scores ~90%.

## [4.0.1] - 2026-05-18

Documentation-only release. **No code or API changes** — the published library
is byte-for-byte identical to `4.0.0`.

### Changed

- Rewrote the README as a value-first overview: trust badges, a quick-start
  example up front, and the security hardening framed as a strength. The
  `3.x → 4.x` upgrade note was moved out of the hero and softened.
- Reconstructed the pre-`4.0.0` version history (`1.0.0` → `3.4.0`) in this
  changelog from git history and npm publish metadata.

## [4.0.0] - 2026-05-17

A **major, breaking** release that hardens the library for high-volume
RUT/RUN **identity validation in production**. The Modulo 11 algorithm itself
was already correct and is **unchanged** — this release hardens the input
perimeter and tightens the "clean / format / validate" contract.

### Do I need to change anything?

**For most projects, no.** If you call `validate(rut)` /
`validate(rut, { strict: true })` on normally formatted RUTs, or `format()` on
already-valid RUTs, v4 is a **drop-in upgrade**: correct RUTs validate and
format exactly as before.

You only need to act if you rely on one of these specific `3.x` behaviors:

- `format()` "repairing" a number with a **wrong verifier digit** (now returns `null` / throws).
- Passing **non-canonical dot grouping** (`12.345678-5`, `12345.678-5`, …) to `validate()` / `isRutLike()` (now rejected).
- **Pattern-matching on error message text** (messages are now the constant `Invalid RUT input`).
- Catching a `TypeError` from helpers on **non-string input** (they now honor `throwOnError`).

If none of those apply, you can upgrade without code changes. The
[Migration guide](#migration-guide-3x--400) at the end walks through each case.

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
  The `64` cap is a security bound, **not** a format rule: a real RUT is ~9
  significant chars (~12 formatted), so the cap never rejects a realistically
  formatted RUT — it only refuses to _look at_ implausibly long strings. It is
  deliberately set well above any legitimate input yet small enough that the
  bounded patterns can never receive an attack string.
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
  all-same-digit bodies, so generated RUTs also pass
  `validate(_, { strict: true })`.

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

Most upgrades are a version bump with no code changes (see
[Do I need to change anything?](#do-i-need-to-change-anything)). The points
below cover the cases that do need attention:

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

## [3.0.0] – [3.4.0] - 2026-01-23

> Published as a same-day sequence (`3.0.0` → `3.4.0`). The individual
> increments were not separately documented; the changes below are aggregated
> for the 3.x line.

### Added

- **Safe Mode** — `throwOnError: false` on the safe functions to return `null`
  instead of throwing.
- **`isRutLike()`** — cheap RUT-shape check without full validation.
- **Exported TypeScript types** — `DecomposedRut`, `FormatOptions`,
  `SafeOptions`, `ValidateOptions`, `VerifierDigit`.

### Changed

- **ESM-first & tree-shakeable** — added `"type": "module"`,
  `"sideEffects": false`, and an `exports` map so consumers only bundle what
  they import.
- **Reduced bundle size** and optimized the core functions.
- Broadened validation/normalization flexibility and expanded the test suite.

## [2.1.0] - 2024-05-29

### Changed

- Improved `format()` behavior; documentation updates.

## [2.0.0] - 2024-05-28

### Changed

- Internal refactor for code reuse; JSDoc added across the public API.
- `calculateVerifier` exported and documented.

### Added

- Expanded test suite.

## [1.4.0] - 2024-05-16

### Added

- Error-message helpers `getInvalidRutError` / `getInvalidRutBodyError`.
- Minified build, additional tests, and a Nextra documentation site.

## [1.2.0] - 2024-05-03

> "Huge update" — the public API took its current shape.

### Changed

- Renamed `check` → `validate` and `getVerifierDigit` → `calculateVerifier`.

### Added

- `getBody`, `getVerifier`, `decompose`, and `generate`.

## [1.0.0] - 2022-03-11

- Initial public release. Core API: `check`, `clean`, `format`,
  `getVerifierDigit`.

> Interim publishes `1.1.0`, `1.3.0`, and `1.3.1` (Apr–May 2024) were
> incremental steps between the entries above and are not detailed separately.

[5.0.0]: https://github.com/arrowsw/rut.ts/releases/tag/v5.0.0
[4.1.0]: https://github.com/arrowsw/rut.ts/releases/tag/v4.1.0
[4.0.1]: https://github.com/arrowsw/rut.ts/releases/tag/v4.0.1
[4.0.0]: https://github.com/arrowsw/rut.ts/releases/tag/v4.0.0
[3.4.0]: https://github.com/arrowsw/rut.ts/releases/tag/3.4.0
[2.1.0]: https://github.com/arrowsw/rut.ts/releases/tag/v2.1.0
[2.0.0]: https://github.com/arrowsw/rut.ts/releases/tag/v2.0.0
