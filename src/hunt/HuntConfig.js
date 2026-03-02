export const HUNT_CONFIG = Object.freeze({
    DEFAULT_MODE: 'CLASSIC',
    DEFAULT_RESPAWN_ENABLED: false,
    PLAYER_MAX_HP: 100,
    PLAYER_REGEN_PER_SECOND: 2.5,
    PLAYER_REGEN_DELAY: 3.0,
    SHIELD_MAX_HP: 40,
    COLLISION_DAMAGE: Object.freeze({
        WALL: 22,
        TRAIL: 34,
        PLAYER_CRASH: 40,
    }),
    MG: Object.freeze({
        DAMAGE: 9,
        COOLDOWN: 0.08,
        OVERHEAT_PER_SHOT: 6.5,
        COOLING_PER_SECOND: 22,
        LOCKOUT_THRESHOLD: 100,
        LOCKOUT_SECONDS: 1.2,
        RANGE: 95,
        MIN_FALLOFF: 0.5,
        AIM_DOT_MIN: 0.965,
    }),
    ROCKET_TIERS: Object.freeze({
        WEAK: Object.freeze({ damage: 15, spawnChance: 0.6 }),
        MEDIUM: Object.freeze({ damage: 35, spawnChance: 0.3 }),
        STRONG: Object.freeze({ damage: 60, spawnChance: 0.1 }),
    }),
    ROCKET_PICKUP_SPAWN_CHANCE: 0.45,
    RESPAWN: Object.freeze({
        DELAY_SECONDS: 3.0,
        INVULNERABILITY_SECONDS: 1.0,
    }),
});
