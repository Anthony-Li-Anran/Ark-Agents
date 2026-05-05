# Kal'tsit Animation Table

## Standard Animations

| Animation | Description |
|-----------|-------------|
| Default | Default animation |
| Interact | Interaction animation |
| Move | Movement animation |
| Relax | Relax animation |
| Relax_Idle | Alternative relax animation |
| Sit | Sitting animation |
| Sleep | Sleeping animation |

## WS Suffix Animations (Detected by test script)

| Animation | Description |
|-----------|-------------|
| DefaultWS | Default animation (WS variant) |
| InteractWS | Interaction animation (WS variant) |
| MoveWS | Movement animation (WS variant) |
| RelaxWS | Relax animation (WS variant) |
| SitWS | Sitting animation (WS variant) |
| SleepWS | Sleeping animation (WS variant) |

## Other Detected Animations

| Animation | Description |
|-----------|-------------|
| Aap | Unknown animation |
| Amp | Unknown animation |
| Atz | Unknown animation |
| Axz | Unknown animation |
| Blz | Unknown animation |
| Bpz | Unknown animation |
| Nfw | Unknown animation |
| Vff | Unknown animation |

## Animation Configuration

Kal'tsit uses the same animation configuration as Texas:

```javascript
{
    day: {
        'Relax': { next: ['Relax_Idle', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
        'Relax_Idle': { next: ['Relax', 'Move', 'Sit'], weight: [0.3, 0.3, 0.4] },
        'Sit': { next: ['Relax', 'Relax_Idle', 'Move'], weight: [0.35, 0.35, 0.3] },
        'Move': { next: ['Relax', 'Relax_Idle', 'Sit'], weight: [0.35, 0.35, 0.3] }
    },
    sleep: {
        'Relax': { next: ['Sleep'], weight: [1] },
        'Relax_Idle': { next: ['Sleep'], weight: [1] },
        'Sleep': { next: ['Sleep'], weight: [1] }
    }
}
```
