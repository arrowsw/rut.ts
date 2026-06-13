# Security Policy

`rut.ts` treats RUT/RUN validation as an identity-security boundary, not just
string formatting. We take security reports seriously and appreciate
responsible disclosure.

## Supported versions

Security fixes are provided for the latest minor of the current major line.

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.** Public
disclosure before a fix is available puts every downstream user at risk.

Instead, report privately through GitHub:

1. Go to the [**Security** tab](https://github.com/arrowsw/rut.ts/security) of
   the repository.
2. Click **"Report a vulnerability"** to open a private advisory.

If you cannot use GitHub's private reporting, you may reach the maintainers via
the contact listed on the repository's GitHub organization page.

### What to include

- A description of the issue and its impact.
- A minimal reproduction (input string, function called, observed vs expected
  result), or a proof-of-concept for resource-exhaustion issues.
- The affected version(s).

### Response targets

- **Acknowledgement:** within 72 hours.
- **Triage and severity assessment:** within 7 days.
- **Fix or mitigation:** as fast as severity warrants; we will keep you updated
  and coordinate a disclosure timeline with you.

## Scope

Reports we especially care about, given the library's purpose:

- **Resource exhaustion / ReDoS** — input that causes super-linear CPU or memory
  use. Inputs are length-capped (64 chars) before any regex runs and patterns
  are non-backtracking; a counter-example to that is in scope.
- **Validation bypass** — an invalid RUT that `validate()` (or
  `validate(_, { strict: true })`) accepts, or a valid one it rejects.
- **Information disclosure** — any path where a RUT value leaks into an error
  message, log, or stack trace. Errors are intentionally the generic constant
  `Invalid RUT input`.

Out of scope: vulnerabilities in dependencies of the development toolchain that
do not affect the published, zero-runtime-dependency package; issues that
require a non-default, clearly-documented permissive helper (`clean()`,
`decompose()`) to be misused as a validation gate.

## Supply chain

Releases are published from CI on a signed tag with
[npm provenance](https://docs.npmjs.com/generating-provenance-statements)
(a Sigstore attestation linking each tarball to its source commit and build).
You can verify an installed copy with:

```bash
npm audit signatures
```
