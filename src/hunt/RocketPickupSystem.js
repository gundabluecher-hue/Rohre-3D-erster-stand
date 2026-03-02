import { CONFIG } from '../core/Config.js';

const TIER_BY_ITEM = Object.freeze({
    ROCKET_WEAK: 'WEAK',
    ROCKET_MEDIUM: 'MEDIUM',
    ROCKET_STRONG: 'STRONG',
});

export function isRocketTierType(type) {
    return Object.prototype.hasOwnProperty.call(TIER_BY_ITEM, String(type || '').toUpperCase());
}

export function getRocketTierTypes() {
    return Object.keys(TIER_BY_ITEM);
}

export function resolveRocketTierDamage(type) {
    const normalized = String(type || '').toUpperCase();
    const tier = TIER_BY_ITEM[normalized];
    const tierConfig = CONFIG?.HUNT?.ROCKET_TIERS?.[tier];
    if (tierConfig && Number.isFinite(Number(tierConfig.damage))) {
        return Math.max(1, Number(tierConfig.damage));
    }

    const fallback = CONFIG?.POWERUP?.TYPES?.[normalized]?.damage;
    return Math.max(1, Number(fallback || 15));
}

export function pickWeightedRocketTierType() {
    const tiers = CONFIG?.HUNT?.ROCKET_TIERS || {};
    const weighted = [
        { type: 'ROCKET_WEAK', weight: Number(tiers.WEAK?.spawnChance || 0.6) },
        { type: 'ROCKET_MEDIUM', weight: Number(tiers.MEDIUM?.spawnChance || 0.3) },
        { type: 'ROCKET_STRONG', weight: Number(tiers.STRONG?.spawnChance || 0.1) },
    ];
    const total = weighted.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    if (total <= 0) return 'ROCKET_WEAK';

    const roll = Math.random() * total;
    let acc = 0;
    for (const entry of weighted) {
        acc += Math.max(0, entry.weight);
        if (roll <= acc) {
            return entry.type;
        }
    }
    return 'ROCKET_STRONG';
}
