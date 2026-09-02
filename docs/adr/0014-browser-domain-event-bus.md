# 0014: Browser domain events for optional game features

## Status

Accepted

## Context

Game controllers directly invoked the procedural audio API at interesting
gameplay transitions. That made a presentation feature part of each controller
and would require similar coupling for future visual effects, tutorials,
accessibility helpers, or analytics. The shared shell also used several unrelated
DOM `CustomEvent` names for themes, users, score notifications, and audio state.

The arcade remains build-free and must keep mechanics deterministic. Browser
messages cannot become evidence for scores or achievements, and repeated online
snapshots must not replay already-presented transitions.

## Decision

Add `scripts/game-events.js`, a synchronous, dependency-free, page-local event
bus. Game controllers publish immutable semantic facts and shared lifecycle
events. Presentation adapters subscribe independently; `scripts/audio.js` owns
the mapping from domain events to audio cues and music state. The shared shell
uses the same bus for theme, account, validated achievement, validated top-score,
and audio-preference notifications.

Events use a versioned envelope, namespaced lowercase types, normalized game id,
page-local sequence, source, timestamp, and shallow-frozen detail. Listener
failures are isolated from producers. The bus stores no history and provides no
cross-page or server transport.

Online controllers establish presentation watermarks from resume snapshots and
emit only newly observed transitions. Server-derived scores, result validation,
achievement evaluation, and authoritative room state remain outside the browser
bus. Direct async result submission remains explicit because callers consume its
validated response and error state.

## Consequences

- Games no longer import or call the audio presentation contract.
- New optional browser features can subscribe without editing mechanics or
  existing consumers.
- Event names and payloads become shared contracts that require documentation and
  compatibility care.
- The bus is unsuitable for commands, persistence, security decisions, or event
  sourcing; those require explicit server-owned designs.
- Snapshot and burst producers must continue to deduplicate, watermark, or
  summarize events before publishing them.
