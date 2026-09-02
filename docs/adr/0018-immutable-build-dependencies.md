# ADR 0018: Pin build dependencies to immutable revisions

**Status:** Accepted

**Decision:** Reference every third-party GitHub Action by its full commit SHA and
every container base image by a registry digest. Keep the corresponding release
tag in comments or beside the digest for maintainability. Resolve Node through
its multi-platform manifest so the published AMD64 and ARM64 images use the same
reviewed upstream release.

Update pins deliberately in focused pull requests, reviewing upstream release
notes and allowing the complete test-and-build workflow to validate the new
revisions. Dependabot checks GitHub Actions, Docker, and npm daily, opens grouped
version and security update pull requests, and preserves immutable Action SHAs
and container digests. Static tests reject movable references and missing update
coverage.

**Consequences:** A moved or compromised upstream tag cannot silently alter a
workflow or container build. Routine dependency updates require explicit SHA and
digest changes, while update pull requests keep those pins from silently aging.
