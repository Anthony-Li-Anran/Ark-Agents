# Texas Animation Table

| Animation | Description |
|-----------|-------------|
| Default2 | Default animation |
| Interact2 | Interaction animation used on left click |
| Move2 | Movement animation used for MoveLeft2 and MoveRight2 state aliases |
| Relax2 | Relax idle animation |
| Relax_Idle2 | Alternate relax idle animation |
| Sit2 | Sitting animation |
| Sleep2 | Sleeping animation |

## Current State Mapping

| State | Spine Animation | Notes |
|-------|-----------------|-------|
| Relax2 | Relax2 | Default idle state |
| Sit2 | Sit2 | Idle transition state |
| MoveLeft2 | Move2 | Moves left by flipping direction |
| MoveRight2 | Move2 | Moves right by flipping direction |
| Interact2 | Interact2 | Plays once on left click, then returns to Relax2 |
