export const SETTINGS_LIMITS = Object.freeze({
    session: Object.freeze({
        numBots: Object.freeze({ min: 0, max: 8, integer: true }),
        winsNeeded: Object.freeze({ min: 1, max: 15, integer: true }),
    }),
    gameplay: Object.freeze({
        speed: Object.freeze({ min: 8, max: 40 }),
        turnSensitivity: Object.freeze({ min: 0.8, max: 5 }),
        planeScale: Object.freeze({ min: 0.6, max: 2 }),
        trailWidth: Object.freeze({ min: 0.2, max: 2.5 }),
        gapSize: Object.freeze({ min: 0.05, max: 1.5 }),
        gapFrequency: Object.freeze({ min: 0, max: 0.25 }),
        itemAmount: Object.freeze({ min: 1, max: 20, integer: true }),
        fireRate: Object.freeze({ min: 0.1, max: 2 }),
        lockOnAngle: Object.freeze({ min: 5, max: 45, integer: true }),
        mgTrailAimRadius: Object.freeze({ min: 0.2, max: 3 }),
        portalCount: Object.freeze({ min: 0, max: 20, integer: true }),
        planarLevelCount: Object.freeze({ min: 2, max: 10, integer: true }),
    }),
    botBridge: Object.freeze({
        timeoutMs: Object.freeze({ min: 20, max: 5000, integer: true }),
    }),
});

function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampSettingValue(value, limits, fallback) {
    const min = Number(limits?.min);
    const max = Number(limits?.max);
    const integer = !!limits?.integer;
    const fallbackNumber = toFiniteNumber(fallback, min);
    const raw = toFiniteNumber(value, fallbackNumber);
    const normalized = integer ? Math.trunc(raw) : raw;
    return Math.min(max, Math.max(min, normalized));
}

export function normalizeControlBindings(source, fallback, { guardCombatConflicts = false } = {}) {
    const src = source && typeof source === 'object' ? source : {};
    const base = fallback || {};

    const shoot = src.SHOOT || base.SHOOT;
    let shootMg = src.SHOOT_MG || base.SHOOT_MG;
    let drop = src.DROP || base.DROP;

    if (guardCombatConflicts) {
        if (shootMg === shoot) {
            const fallbackShootMg = base.SHOOT_MG;
            if (fallbackShootMg && fallbackShootMg !== shoot) {
                shootMg = fallbackShootMg;
            }
        }
        if (drop === shootMg) {
            const fallbackDrop = base.DROP;
            if (fallbackDrop && fallbackDrop !== shoot && fallbackDrop !== shootMg) {
                drop = fallbackDrop;
            }
        }
    }

    return {
        UP: src.UP || base.UP,
        DOWN: src.DOWN || base.DOWN,
        LEFT: src.LEFT || base.LEFT,
        RIGHT: src.RIGHT || base.RIGHT,
        ROLL_LEFT: src.ROLL_LEFT || base.ROLL_LEFT,
        ROLL_RIGHT: src.ROLL_RIGHT || base.ROLL_RIGHT,
        BOOST: src.BOOST || base.BOOST,
        SHOOT: shoot,
        SHOOT_MG: shootMg,
        NEXT_ITEM: src.NEXT_ITEM || base.NEXT_ITEM,
        DROP: drop,
        CAMERA: src.CAMERA || base.CAMERA,
    };
}

export function normalizeGlobalControlBindings(source, fallback) {
    const src = source && typeof source === 'object' ? source : {};
    const base = fallback || {};
    return {
        CINEMATIC_TOGGLE: src.CINEMATIC_TOGGLE || base.CINEMATIC_TOGGLE || 'F8',
    };
}

export function createControlBindingsSnapshot(controls, fallbackControls, options = {}) {
    const defaults = fallbackControls || {};
    const src = controls && typeof controls === 'object' ? controls : {};
    return {
        PLAYER_1: normalizeControlBindings(src.PLAYER_1, defaults.PLAYER_1, options),
        PLAYER_2: normalizeControlBindings(src.PLAYER_2, defaults.PLAYER_2, options),
        GLOBAL: normalizeGlobalControlBindings(src.GLOBAL, defaults.GLOBAL),
    };
}
