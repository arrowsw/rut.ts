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
   `package.json`, or if the tagged commit is not on `canary`.
4. **Tokenless publishing.** The workflow authenticates via npm Trusted
   Publishing (GitHub OIDC) and publishes with `--provenance`. There is no
   `NPM_TOKEN` secret to rotate or leak.
5. **What is tested is what ships.** The package is built once, tested, packed
   into a tarball, and that same tarball is installed, tested again and
   published.

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

5. The `Publish` workflow takes it from there, in two jobs:
   - **build** (read-only token, no publish credential): checks that the tag
     matches `package.json` and points at a commit on `canary`, runs `npm ci`
     (which builds once via `prepare`), runs the gates (tests, prettier check,
     lint), packs that build with `npm pack --ignore-scripts`, installs the
     tarball in an empty project and tests it
     ([`scripts/smoke-package.mjs`](scripts/smoke-package.mjs)).
   - **publish** (environment `npm`, the only job with `id-token: write`):
     downloads that tarball and runs `npm publish <tarball> --provenance`. It
     runs no project code.
6. If the `npm` environment requires reviewers, approve the publish job in the
   workflow run.
7. Verify: `npm view rut.ts version` and the provenance attestation on
   [npmjs.com/package/rut.ts](https://www.npmjs.com/package/rut.ts).

## Repository and npm settings

The workflow cannot protect itself: whoever can push a `v*` tag also controls
the workflow file in the tagged commit. These settings, outside the repository,
are what limit who can publish. Check them after any change to collaborators
or to the workflow:

- **Tag ruleset.** Settings → Rules → Rulesets: an active ruleset on tags
  matching `v*` that restricts creation, update and deletion to the release
  owner, with no bypass.
- **`npm` environment.** Settings → Environments → `npm` (created by the first
  run of the publish job): required reviewers, and deployments limited to tags
  matching `v*`.
- **npm Trusted Publisher.** npmjs.com → `rut.ts` → Settings → Trusted
  Publisher: repository `arrowsw/rut.ts`, workflow `publish.yml`, environment
  `npm`. With the environment named here, only the protected job can publish.
- **Default token.** Settings → Actions → General → Workflow permissions: "Read
  repository contents and packages permissions". The workflows already ask for
  read-only tokens; this keeps any new workflow read-only too.

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
