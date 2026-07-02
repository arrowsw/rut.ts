# Differential report — frozen baselines vs current (5.0.0)

- Seed: `0x52555420` (reproducible)
- Corpus size: **1,000,000** validate inputs, **50,004** equals pairs

## v3.4.0 → current — `validate()`

- Agree valid (`true/true`): **201,239**
- Agree invalid (`false/false`): **623,677**
- ⚠️ Regressions (was `true` → now `false`): **125,084**
- New acceptances (was `false` → now `true`): **50,000**

### ⚠️ Regressions by input shape (potential false negatives for a 3.x dataset)

| Input shape | Count | Samples |
|-------------|------:|---------|
| `dotted-no-hyphen` | 50000 | `19.872.8500`, `9.114.8080`, `47.739.4396`, `3.948.4315`, `57.903.7091`, `5.769.9043`, `48.181.8354`, `6.280.4750` |
| `leading-zeros` | 50000 | `00198728500`, `0091148080`, `00477394396`, `0039484315`, `00579037091`, `0057699043`, `00481818354`, `0062804750` |
| `noncanonical-grouping` | 25082 | `19.872850-0`, `47.739439-6`, `57.903709-1`, `48.181835-4`, `77.697779-9`, `33.841571-0`, `54.040135-7`, `47.183067-4` |
| `len-64-padded-valid` | 1 | `0000000000000000000000000000000000000…` |
| `len-65-over-cap` | 1 | `0000000000000000000000000000000000000…` |

### New acceptances by input shape

| Input shape | Count | Samples |
|-------------|------:|---------|
| `surrounding-space` | 50000 | `  19.872.850-0  `, `  9.114.808-0  `, `  47.739.439-6  `, `  3.948.431-5  `, `  57.903.709-1  `, `  5.769.904-3  `, `  48.181.835-4  `, `  6.280.475-0  ` |

## v4.1.0 → current — `validate()` (the migration most upgraders make)

- Agree valid (`true/true`): **251,239**
- Agree invalid (`false/false`): **698,760**
- ⚠️ Regressions (was `true` → now `false`): **50,001**
- New acceptances (was `false` → now `true`): **0** (must be 0)

### ⚠️ Regressions by input shape (potential false negatives for a 4.x dataset)

| Input shape | Count | Samples |
|-------------|------:|---------|
| `leading-zeros` | 50000 | `00198728500`, `0091148080`, `00477394396`, `0039484315`, `00579037091`, `0057699043`, `00481818354`, `0062804750` |
| `len-64-padded-valid` | 1 | `0000000000000000000000000000000000000…` |

Both shapes are the same documented 5.0.0 change: leading-zero padding is no
longer accepted by the predicates. Normalize with `clean()` or ingest through
`parse()` (lenient by default) before validating.

## v4.1.0 → current — `equals()` default mode

- Pairs compared: **50,004** — agree: **33,336**
- ⚠️ Divergences (4.1.0 and current disagree): **16,668**

| Pair shape | Count | Samples |
|------------|------:|---------|
| `pair-wrong-dv-identical` | 8334 | `3929252-3 ≟ 3929252-3`, `6357228-7 ≟ 6357228-7`, `69960901-7 ≟ 69960901-7`, `57642064-5 ≟ 57642064-5`, `1895817-2 ≟ 1895817-2`, `6455043-5 ≟ 6455043-5`, `2310096-2 ≟ 2310096-2`, `1544037-2 ≟ 1544037-2` |
| `pair-wrong-dv-cross-shape` | 8334 | `39292523 ≟ 3929252-3`, `63572287 ≟ 6357228-7`, `699609017 ≟ 69960901-7`, `576420645 ≟ 57642064-5`, `18958172 ≟ 1895817-2`, `64550435 ≟ 6455043-5`, `23100962 ≟ 2310096-2`, `15440372 ≟ 1544037-2` |

Every divergence is the documented 5.0.0 `equals` change: the default now
requires a valid Modulo 11 verifier, so wrong-DV pairs stop comparing equal.
Legacy parity: `equals(a, b, { requireValid: false })` matched v4.1.0 on
**50,004 / 50,004** pairs (must be all).

## Security spot checks

- `validate('8.888.888-K', { strict: true })` — v3.4.0: **true** (bug: should be false), current: **false**
- Non-string inputs with diverging result: **0** (none — both reject)
- ReDoS: `validate('0'.repeat(100000) + 'x')` on current → **false** in **0.07 ms** (the frozen 3.4.0 regex exhibits catastrophic backtracking on this input and is deliberately not run here)

## How to read this

`generate()`/canonical inputs land in *Agree valid*. The **Regressions** table
is the actionable part: every shape there is an input format that v3.4.0
accepted and the current src now rejects. Confirm your production dataset uses **none**
of those shapes (or normalize it to compact / compact+hyphen / canonical-dotted)
before upgrading. This harness cannot prove safety on data it never saw — it
enumerates exactly what changed.
