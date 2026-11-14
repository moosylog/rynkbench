# Architecture decision records

One short page per decision that shapes the code, so the reason survives the people who made it. Format: status, context, decision, consequences. A decision that changes gets a new record that supersedes the old one; old records are not rewritten.

| # | Decision | Status |
|---|---|---|
| [0001](0001-layering.md) | Layers depend downward only, enforced by a ratcheted test | Accepted |
| [0002](0002-capability-contract.md) | Every keyboard function is a declared capability | Proposed |
| [0003](0003-derived-graph-and-policy.md) | Entities are stored, the graph is derived, one policy engine decides | Proposed |
| [0004](0004-own-model-rmk-first.md) | A neutral model of our own; first release is RMK only | Accepted |
| [0005](0005-themes.md) | Dark and light themes under one set of token names | Accepted |
| [0006](0006-wording.md) | Two voices for the app's own words, from one table | Accepted |
| [0007](0007-areas-and-type-scale.md) | Six areas from the capability set; named type sizes | Partly superseded by 0008 |
| [0008](0008-glide-main-screen.md) | GLIDE's main screen and look | Accepted |
| [0009](0009-key-slots-on-rmk.md) | GLIDE's key slots on RMK bindings | Accepted |
| [0010](0010-draft-and-live.md) | Draft and Live: when changes reach the keyboard | Accepted |
| [0011](0011-guard.md) | Rynkbench Guard: one gate for every key write | Accepted |
| [0012](0012-sync.md) | One write path: plan the difference, write only that | Accepted |
| [0013](0013-one-history-one-gate.md) | One document, one history, one gate: adopted module by module | Accepted |

The glossary is in [../glossary.md](../glossary.md).
