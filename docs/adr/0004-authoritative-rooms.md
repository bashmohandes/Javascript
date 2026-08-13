# ADR 0004: Authoritative, ephemeral online rooms

**Status:** Accepted

**Decision:** Keep rooms in process. Clients send intent; room managers validate
lifecycle and game commands, while servers own online state (including real-time
Pong and Battle Tanks simulation). Expire abandoned rooms and allow short token-
based reconnection.

```mermaid
flowchart LR
  Client -->|intent| Room[room manager] --> Engine[authoritative state]
  Engine -->|snapshot| Client
  Room -->|timeout/restart| Gone[room removed]
```

**Consequences:** Players converge on one state without room persistence or
cleanup jobs; matches do not survive process restart and one process owns every
active room.

