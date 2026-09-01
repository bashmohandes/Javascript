# 0012: Shared app-install surface

## Status

Accepted

## Context

The arcade already has a root web-app manifest, while Pong also exposed a
separate game manifest and several modern pages did not link a manifest at all.
Browsers expose installation differently: Chromium can offer a native install
prompt, iPhone and iPad browsers use the share sheet, and recent Safari versions
on macOS use Add to Dock. An install suggestion must not promise support where
the browser has not exposed a viable path, and it must disappear in standalone
mode.

## Decision

`arcade.js` owns the install suggestion and instructions as part of the shared
browser shell. It ensures pages using the shell reference the root arcade
manifest and the Apple standalone metadata. Pong now references that same root
manifest so every shared install action installs JavaScript Arcade rather than
a game-specific application. The shell registers a root service worker that
uses network-first static requests and a versioned cache. API requests are
explicitly excluded from interception and caching.

The shell shows the hint only when a native `beforeinstallprompt` event has been
received or when the current Apple/Android browser has a known manual install
path. It suppresses the hint in installed display modes, after `appinstalled`,
and after a session-scoped dismissal. Native prompts are invoked only from the
user's explicit Install button; manual platforms receive numbered,
platform-specific instructions.

## Consequences

- Modern pages share one application identity, scope, start URL, and install UI.
- Browser capability signals take precedence over user-agent inference.
- Classic pages remain unchanged because they do not run the shared shell.
- The visited static arcade surface can fall back to cached responses offline;
  APIs, accounts, and online matches remain network-only.
