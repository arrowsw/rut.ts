# Releasing

How `rut.ts` versions are cut and published to npm.

## Principles

1. **Feature PRs never bump the version.** No PR that changes behavior touches
   `version` in `package.json` / `package-lock.json`. (PR #35 shipped its own
   bump and is grandfathered — it was the last time we do that.)
2. **A release is its own PR.** The version bump and the CHANGELOG
   finalization land in a dedicated release PR that contains nothing else.
3. **Publishing is tag-triggered only.** Merging to `canary` never publishes.
   The only trigger is pushing a `vX.Y.Z` tag, which runs
   [`.github/workflows/publish.yml`](.github/workflows/publish.yml). The
   workflow refuses to publish if the tag does not match the version in
   `package.json`.
4. **Tokenless publishing.** The workflow authenticates via npm Trusted
   Publishing (GitHub OIDC) and publishes with `--provenance`. There is no
   `NPM_TOKEN` secret to rotate or leak.

## Cutting a release

1. Confirm `canary` is green and every PR scoped to the release is merged.
2. Open a **release PR** against `canary` containing only:
   - the version bump: `npm version X.Y.Z --no-git-tag-version`
     (updates `package.json` and `package-lock.json`, creates no tag), and
   - the CHANGELOG finalization: date the `[X.Y.Z]` section and give it a
     final read.

   Branch `release/X.Y.Z`, commit `chore(release): X.Y.Z`.
3. Squash-merge the release PR (repo convention).
4. Tag the merge commit and push the tag:

   ```sh
   git checkout canary && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. The `Publish` workflow takes it from there: `npm ci` (builds via
   `prepare`), the `prepublishOnly` gate (tests + prettier + lint), the
   tag-vs-`package.json` check, and `npm publish --provenance`.
6. Verify: `npm view rut.ts version` and the provenance attestation on
   [npmjs.com/package/rut.ts](https://www.npmjs.com/package/rut.ts).

## After publishing

- Create the GitHub Release from the tag, pasting the CHANGELOG section.
- Update the docs site (`www-rut.ts`): bump its `rut.ts` dependency to the
  published version and sync any docs content that describes the new
  behavior.

## State of play for 5.0.0

The 5.0.0 version bump already landed with PR #35, so `canary` reads `5.0.0`
while npm still serves `4.1.0`. That is expected and harmless: nothing
publishes until the tag exists. The 5.0.0 release PR therefore only finalizes
the CHANGELOG — no bump needed. **Do not push a `v5.0.0` tag until the v5
scope (issue #36) is complete.**
