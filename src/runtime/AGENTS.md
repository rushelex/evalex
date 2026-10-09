# AGENTS.md — runtime

- The runtime never owns user data. Every read and write of a node goes through the host's adapter.
- One failing formula never stops the others. Failures reach the host through the adapter's error callback and are not thrown out of processing. The only exception is a synchronous misuse of the API by the host, such as a duplicate id.
- Once processing finishes, every formula holds the value it would have if all formulas were evaluated in dependency order.
- The runtime limits are product guarantees. Changing a limit needs the owner's approval.
- The runtime must stay usable on a browser main thread. Asynchronous execution honors timeouts and abort signals.
- Ordering, batching and cancellation are tested under arbitrary timing, not only along the happy path.
