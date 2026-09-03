# ADR 0026: Separate alpha builds from controlled stable releases

**Status:** Accepted

## Context

Publishing `latest` for every merge made the default container a continuous
snapshot rather than an intentional release. The application exposed its build
identifier but had no durable release history or player-facing explanation of
what changed. Commit messages are intentionally concise and do not follow a
machine-enforced convention, so they are not sufficient release-note copy.

## Decision

1. `master` is the integration branch and publishes the movable `alpha` image
   plus an immutable `sha-*` image after tests, syntax checks, dependency audit,
   container build, and vulnerability scan pass.
2. `release` is a protected, long-lived stable branch. Code reaches it only in
   a promotion pull request from `master`. Merging that pull request validates
   the candidate but does not publish it.
3. Stable publication is a manual workflow dispatched on `release` with an
   exact SemVer. The workflow repeats every quality gate before publishing
   `latest`, the full version, the major/minor version, and an immutable SHA,
   then creates the matching immutable Git tag and GitHub Release.
4. `releases.json` is the ordered release record. Its newest entry and
   `package.json` must match the requested stable version. Player highlights
   and fixes are exposed in the product; technical notes are included only in
   the generated GitHub Release.
5. Stable builds show their notes automatically once per version and browser.
   The shared footer always reopens build details. Alpha and development builds
   identify their channel but never auto-display unpublished notes.
6. Scheduled CI continues to rebuild and rescan without publishing. Urgent
   fixes follow the same `master` to `release` promotion path.

## Consequences

Operators can follow `latest` for deliberate releases or `alpha` for the newest
accepted change. Stable releases require a curated manifest entry and an
explicit promotion, adding a small amount of ceremony in exchange for a clear
approval point, reproducible notes, and immutable rollback tags. Seen state is
device-local and requires no account migration.

The initial controlled release is `1.0.0`, matching the existing package
version and providing a baseline for subsequent SemVer releases.
