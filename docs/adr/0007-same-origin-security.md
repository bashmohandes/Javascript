# ADR 0007: Same-origin deployment with layered HTTP security

**Status:** Accepted

**Decision:** Serve pages, API, and WebSockets from one origin behind HTTPS.
Validate origins (with an explicit allowlist), rate-limit sensitive actions, cap
payloads, set restrictive headers, hide private paths, and trust proxy headers
only when configured.

```mermaid
flowchart LR
  Browser --> TLS[trusted reverse proxy] --> Guard[origin + limits + headers] --> App
  Allowlist --> Guard
```

**Consequences:** Cookies and invitation URLs stay simple and the attack surface
is constrained; split-origin clients require configuration and proxy trust must
match the actual network boundary.

