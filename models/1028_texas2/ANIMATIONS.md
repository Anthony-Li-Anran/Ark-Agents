# Texas the Omertosa Animation Table

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

## Special Animations (Detected by test script)

| Animation | Description |
|-----------|-------------|
| OnAttack | Attack trigger animation |
| OnStart | Start trigger animation |
| Back | Back direction animation |
| Front | Front direction animation |

## Other Detected Animations

| Animation | Description |
|-----------|-------------|
| Abff | Unknown animation |
| Ahz | Unknown animation |
| Aip | Unknown animation |
| Apa | Unknown animation |
| Aq8 | Unknown animation |
| Ar9 | Unknown animation |
| Ayp | Unknown animation |
| Bjb | Unknown animation |
| Cnf | Unknown animation |
| Fff | Unknown animation |
| Pjp | Unknown animation |

## Animation Configuration

Texas the Omertosa uses the same animation configuration as Texas:

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

## Notes

- Texas the Omertosa has additional special animations (`OnAttack`, `OnStart`, `Back`, `Front`) compared to the original Texas
- These special animations may be used for specific gameplay mechanics or events
