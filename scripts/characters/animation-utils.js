/**
 * Animation Utils
 * Provides regex-based mapping between generic animation states and model-specific animation names.
 */

const CANONICAL_ANIMATIONS = [
    {
        key: 'Relax_Idle',
        patterns: [/^Relax(?:_Idle)?(?:\d+|WS)?$/i],
    },
    {
        key: 'MoveLeft',
        patterns: [/^MoveLeft(?:\d+|WS)?$/i],
    },
    {
        key: 'MoveRight',
        patterns: [/^MoveRight(?:\d+|WS)?$/i],
    },
    {
        key: 'Relax',
        patterns: [/^Relax(?:\d+|WS)?$/i],
    },
    {
        key: 'Move',
        patterns: [/^Move(?:\d+|WS)?$/i],
    },
    {
        key: 'Sit',
        patterns: [/^Sit(?:\d+|WS)?$/i],
    },
    {
        key: 'Sleep',
        patterns: [/^Sleep(?:\d+|WS)?$/i],
    },
    {
        key: 'Interact',
        patterns: [/^Interact(?:\d+|WS)?$/i],
    },
    {
        key: 'Default',
        patterns: [/^Default(?:\d+|WS)?$/i],
    }
];

const CANONICAL_MAP = CANONICAL_ANIMATIONS.reduce((map, item) => {
    map[item.key.toLowerCase()] = item;
    return map;
}, {});

function normalizeAnimationKey(name) {
    if (!name || typeof name !== 'string') return name;
    const trimmed = name.trim();
    const exact = CANONICAL_MAP[trimmed.toLowerCase()];
    if (exact) return exact.key;

    for (const item of CANONICAL_ANIMATIONS) {
        for (const pattern of item.patterns) {
            if (pattern.test(trimmed)) {
                return item.key;
            }
        }
    }

    return trimmed;
}

function matchAnimationName(canonicalName, availableAnimations = []) {
    if (!canonicalName || !Array.isArray(availableAnimations) || availableAnimations.length === 0) {
        return canonicalName;
    }

    const normalizedKey = normalizeAnimationKey(canonicalName);

    const exactMatch = availableAnimations.find(
        anim => typeof anim === 'string' && anim.toLowerCase() === normalizedKey.toLowerCase()
    );
    if (exactMatch) {
        return exactMatch;
    }

    const canonical = CANONICAL_MAP[normalizedKey.toLowerCase()];
    if (canonical) {
        for (const pattern of canonical.patterns) {
            const match = availableAnimations.find(anim => pattern.test(anim));
            if (match) {
                return match;
            }
        }
    }

    if (/^Move(?:Left|Right)$/i.test(normalizedKey)) {
        return matchAnimationName('Move', availableAnimations);
    }

    if (normalizedKey.includes('_')) {
        const altKey = normalizedKey.replace(/_/g, '');
        const altMatch = availableAnimations.find(anim => typeof anim === 'string' && anim.toLowerCase().startsWith(altKey.toLowerCase()));
        if (altMatch) {
            return altMatch;
        }
    }

    return availableAnimations.find(anim => typeof anim === 'string' && anim.toLowerCase().startsWith(normalizedKey.toLowerCase())) || null;
}

module.exports = {
    normalizeAnimationKey,
    matchAnimationName
};