import { CONFIG } from '../core/Config.js';
import { GAME_MODE_TYPES, isHuntMode } from './HuntMode.js';

function toSafeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getNowSeconds() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now() * 0.001;
    }
    return Date.now() * 0.001;
}

function getActiveMode(config = CONFIG) {
    return String(config?.HUNT?.ACTIVE_MODE || config?.HUNT?.DEFAULT_MODE || GAME_MODE_TYPES.CLASSIC).toUpperCase();
}

export function isHuntHealthActive(config = CONFIG) {
    const enabled = config?.HUNT?.ENABLED !== false;
    return enabled && isHuntMode(getActiveMode(config), enabled);
}

export function getPlayerMaxHp(config = CONFIG) {
    return Math.max(1, toSafeNumber(config?.HUNT?.PLAYER_MAX_HP, 100));
}

export function getShieldMaxHp(config = CONFIG) {
    return Math.max(1, toSafeNumber(config?.HUNT?.SHIELD_MAX_HP, 40));
}

export function resetPlayerHealth(player, config = CONFIG) {
    if (!player) return null;

    if (!isHuntHealthActive(config)) {
        player.maxHp = 1;
        player.hp = 1;
        player.maxShieldHp = 1;
        player.shieldHP = player.hasShield ? 1 : 0;
        player.lastDamageTimestamp = -Infinity;
        player.shieldHitFeedback = 0;
        return player;
    }

    const maxHp = getPlayerMaxHp(config);
    player.maxHp = maxHp;
    player.hp = maxHp;
    player.maxShieldHp = getShieldMaxHp(config);
    if (player.hasShield) {
        player.shieldHP = player.maxShieldHp;
    } else {
        player.shieldHP = 0;
    }
    player.lastDamageTimestamp = -Infinity;
    player.shieldHitFeedback = 0;
    return player;
}

export function applyDamage(player, amount, options = {}, config = CONFIG) {
    if (!player) {
        return { applied: 0, absorbedByShield: 0, remainingHp: 0, isDead: true };
    }

    const requestedDamage = Math.max(0, toSafeNumber(amount, 0));
    if (requestedDamage <= 0) {
        return {
            applied: 0,
            absorbedByShield: 0,
            remainingHp: Math.max(0, toSafeNumber(player.hp, 0)),
            isDead: toSafeNumber(player.hp, 0) <= 0,
        };
    }

    if (!isHuntHealthActive(config)) {
        player.maxHp = 1;
        player.hp = 0;
        player.shieldHP = 0;
        player.hasShield = false;
        player.lastDamageTimestamp = toSafeNumber(options.nowSeconds, getNowSeconds());
        return {
            applied: requestedDamage,
            absorbedByShield: 0,
            remainingHp: 0,
            isDead: true,
        };
    }

    let remainingDamage = requestedDamage;
    let absorbedByShield = 0;
    const ignoreShield = !!options.ignoreShield;
    if (!ignoreShield && player.shieldHP > 0) {
        absorbedByShield = Math.min(player.shieldHP, remainingDamage);
        player.shieldHP = Math.max(0, player.shieldHP - absorbedByShield);
        remainingDamage -= absorbedByShield;
        if (absorbedByShield > 0) {
            const feedbackValue = Math.min(1, Math.max(0.2, absorbedByShield / Math.max(1, player.maxShieldHp || getShieldMaxHp(config))));
            player.shieldHitFeedback = Math.max(player.shieldHitFeedback || 0, feedbackValue);
        }
        if (player.shieldHP <= 0) {
            player.hasShield = false;
        }
    }

    if (remainingDamage > 0) {
        player.hp = Math.max(0, toSafeNumber(player.hp, player.maxHp) - remainingDamage);
        player.lastDamageTimestamp = toSafeNumber(options.nowSeconds, getNowSeconds());
    }

    return {
        applied: requestedDamage,
        absorbedByShield,
        remainingHp: player.hp,
        isDead: player.hp <= 0,
    };
}

export function applyHealing(player, amount, config = CONFIG) {
    if (!player) return { healed: 0, hp: 0 };
    const healing = Math.max(0, toSafeNumber(amount, 0));
    if (healing <= 0) {
        return { healed: 0, hp: toSafeNumber(player.hp, 0) };
    }

    if (!isHuntHealthActive(config)) {
        player.maxHp = 1;
        player.hp = 1;
        return { healed: 1, hp: 1 };
    }

    const maxHp = Math.max(1, toSafeNumber(player.maxHp, getPlayerMaxHp(config)));
    const before = Math.max(0, toSafeNumber(player.hp, maxHp));
    player.hp = Math.min(maxHp, before + healing);
    return { healed: player.hp - before, hp: player.hp };
}

export function updatePlayerHealthRegen(player, dt, config = CONFIG, nowSeconds = getNowSeconds()) {
    if (!player || !isHuntHealthActive(config)) return;
    if (player.hp <= 0) return;

    const maxHp = Math.max(1, toSafeNumber(player.maxHp, getPlayerMaxHp(config)));
    if (player.hp >= maxHp) return;

    const regenDelay = Math.max(0, toSafeNumber(config?.HUNT?.PLAYER_REGEN_DELAY, 3.0));
    const lastDamageTimestamp = toSafeNumber(player.lastDamageTimestamp, -Infinity);
    if ((nowSeconds - lastDamageTimestamp) < regenDelay) return;

    const regenPerSecond = Math.max(0, toSafeNumber(config?.HUNT?.PLAYER_REGEN_PER_SECOND, 2.5));
    if (regenPerSecond <= 0) return;

    player.hp = Math.min(maxHp, player.hp + regenPerSecond * Math.max(0, dt));
}

export function resolveCollisionDamage(cause = 'WALL', config = CONFIG) {
    if (!isHuntHealthActive(config)) {
        return 1;
    }

    const table = config?.HUNT?.COLLISION_DAMAGE || {};
    const key = String(cause || '').toUpperCase();
    if (key === 'TRAIL' || key === 'TRAIL_SELF' || key === 'TRAIL_OTHER') {
        return Math.max(1, toSafeNumber(table.TRAIL, 34));
    }
    if (key === 'PLAYER_CRASH') {
        return Math.max(1, toSafeNumber(table.PLAYER_CRASH, 40));
    }
    return Math.max(1, toSafeNumber(table.WALL, 22));
}

export function grantShield(player, config = CONFIG) {
    if (!player) return 0;
    player.hasShield = true;
    if (!isHuntHealthActive(config)) {
        player.maxShieldHp = 1;
        player.shieldHP = 1;
        player.shieldHitFeedback = 0;
        return player.shieldHP;
    }
    player.maxShieldHp = getShieldMaxHp(config);
    player.shieldHP = player.maxShieldHp;
    player.shieldHitFeedback = 0;
    return player.shieldHP;
}
