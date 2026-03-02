import { CONFIG } from './Config.js';
import { GAME_MODE_TYPES, isHuntMode, resolveActiveGameMode } from '../hunt/HuntMode.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function cloneControls(controls, fallbackControls) {
    const defaults = fallbackControls || CONFIG.KEYS;
    const src = controls && typeof controls === 'object' ? controls : {};
    const p1 = src.PLAYER_1 || {};
    const p2 = src.PLAYER_2 || {};

    return {
        PLAYER_1: {
            UP: p1.UP || defaults.PLAYER_1.UP,
            DOWN: p1.DOWN || defaults.PLAYER_1.DOWN,
            LEFT: p1.LEFT || defaults.PLAYER_1.LEFT,
            RIGHT: p1.RIGHT || defaults.PLAYER_1.RIGHT,
            ROLL_LEFT: p1.ROLL_LEFT || defaults.PLAYER_1.ROLL_LEFT,
            ROLL_RIGHT: p1.ROLL_RIGHT || defaults.PLAYER_1.ROLL_RIGHT,
            BOOST: p1.BOOST || defaults.PLAYER_1.BOOST,
            SHOOT: p1.SHOOT || defaults.PLAYER_1.SHOOT,
            NEXT_ITEM: p1.NEXT_ITEM || defaults.PLAYER_1.NEXT_ITEM,
            DROP: p1.DROP || defaults.PLAYER_1.DROP,
            CAMERA: p1.CAMERA || defaults.PLAYER_1.CAMERA,
        },
        PLAYER_2: {
            UP: p2.UP || defaults.PLAYER_2.UP,
            DOWN: p2.DOWN || defaults.PLAYER_2.DOWN,
            LEFT: p2.LEFT || defaults.PLAYER_2.LEFT,
            RIGHT: p2.RIGHT || defaults.PLAYER_2.RIGHT,
            ROLL_LEFT: p2.ROLL_LEFT || defaults.PLAYER_2.ROLL_LEFT,
            ROLL_RIGHT: p2.ROLL_RIGHT || defaults.PLAYER_2.ROLL_RIGHT,
            BOOST: p2.BOOST || defaults.PLAYER_2.BOOST,
            SHOOT: p2.SHOOT || defaults.PLAYER_2.SHOOT,
            NEXT_ITEM: p2.NEXT_ITEM || defaults.PLAYER_2.NEXT_ITEM,
            DROP: p2.DROP || defaults.PLAYER_2.DROP,
            CAMERA: p2.CAMERA || defaults.PLAYER_2.CAMERA,
        },
    };
}

function resolveBotDifficulty(requestedDifficulty, botConfig) {
    const botDefaults = botConfig || CONFIG.BOT;
    const fallback = botDefaults.DEFAULT_DIFFICULTY || 'NORMAL';
    const candidate = String(requestedDifficulty || fallback).toUpperCase();
    return Object.prototype.hasOwnProperty.call(botDefaults.DIFFICULTY_PROFILES || {}, candidate)
        ? candidate
        : fallback;
}

export function createRuntimeConfigSnapshot(settings, { baseConfig = CONFIG } = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const gameplaySource = source.gameplay && typeof source.gameplay === 'object' ? source.gameplay : {};
    const huntSource = source.hunt && typeof source.hunt === 'object' ? source.hunt : {};

    const mode = source.mode === '2p' ? '2p' : '1p';
    const numHumans = mode === '2p' ? 2 : 1;
    const huntFeatureEnabled = baseConfig?.HUNT?.ENABLED !== false;
    const activeGameMode = resolveActiveGameMode(source.gameMode, huntFeatureEnabled);
    const huntModeActive = isHuntMode(activeGameMode, huntFeatureEnabled);

    const playerDefaults = baseConfig.PLAYER || CONFIG.PLAYER;
    const gameplayDefaults = baseConfig.GAMEPLAY || CONFIG.GAMEPLAY;
    const trailDefaults = baseConfig.TRAIL || CONFIG.TRAIL;
    const powerupDefaults = baseConfig.POWERUP || CONFIG.POWERUP;
    const projectileDefaults = baseConfig.PROJECTILE || CONFIG.PROJECTILE;
    const botDefaults = baseConfig.BOT || CONFIG.BOT;
    const homingDefaults = baseConfig.HOMING || CONFIG.HOMING;
    const controlsDefaults = baseConfig.KEYS || CONFIG.KEYS;

    const botDifficulty = resolveBotDifficulty(source.botDifficulty, botDefaults);

    const runtimeConfig = {
        session: {
            mode,
            numHumans,
            numBots: clamp(Math.round(toNumber(source.numBots, 0)), 0, 8),
            winsNeeded: clamp(Math.round(toNumber(source.winsNeeded, 5)), 1, 15),
            mapKey: String(source.mapKey || 'standard'),
            portalsEnabled: !!source.portalsEnabled,
            activeGameMode,
        },
        player: {
            speed: clamp(toNumber(gameplaySource.speed, playerDefaults.SPEED), 8, 40),
            turnSpeed: clamp(toNumber(gameplaySource.turnSensitivity, playerDefaults.TURN_SPEED), 0.8, 5),
            modelScale: clamp(toNumber(gameplaySource.planeScale, playerDefaults.MODEL_SCALE), 0.6, 2.0),
            autoRoll: typeof source.autoRoll === 'boolean' ? source.autoRoll : !!playerDefaults.AUTO_ROLL,
            vehicles: {
                PLAYER_1: source?.vehicles?.PLAYER_1 || playerDefaults.DEFAULT_VEHICLE_ID || 'ship5',
                PLAYER_2: source?.vehicles?.PLAYER_2 || playerDefaults.DEFAULT_VEHICLE_ID || 'ship5',
            },
        },
        gameplay: {
            planarMode: !!gameplaySource.planarMode,
            portalCount: clamp(Math.round(toNumber(gameplaySource.portalCount, gameplayDefaults.PORTAL_COUNT || 0)), 0, 20),
            planarLevelCount: clamp(Math.round(toNumber(gameplaySource.planarLevelCount, gameplayDefaults.PLANAR_LEVEL_COUNT || 5)), 2, 10),
            portalBeams: false,
            planarAimInputSpeed: toNumber(gameplayDefaults.PLANAR_AIM_INPUT_SPEED, 1.5),
            planarAimReturnSpeed: toNumber(gameplayDefaults.PLANAR_AIM_RETURN_SPEED, 0.6),
        },
        trail: {
            width: clamp(toNumber(gameplaySource.trailWidth, trailDefaults.WIDTH), 0.2, 2.5),
            gapDuration: clamp(toNumber(gameplaySource.gapSize, trailDefaults.GAP_DURATION), 0.05, 1.5),
            gapChance: clamp(toNumber(gameplaySource.gapFrequency, trailDefaults.GAP_CHANCE), 0, 0.25),
        },
        powerup: {
            maxOnField: clamp(Math.round(toNumber(gameplaySource.itemAmount, powerupDefaults.MAX_ON_FIELD)), 1, 20),
        },
        projectile: {
            cooldown: clamp(toNumber(gameplaySource.fireRate, projectileDefaults.COOLDOWN), 0.1, 2.0),
        },
        bot: {
            activeDifficulty: botDifficulty,
        },
        homing: {
            lockOnAngle: clamp(Math.round(toNumber(gameplaySource.lockOnAngle, homingDefaults.LOCK_ON_ANGLE)), 5, 45),
        },
        controls: cloneControls(source.controls, controlsDefaults),
        hunt: {
            enabled: huntModeActive,
            respawnEnabled: huntModeActive ? !!huntSource.respawnEnabled : false,
        },
        settingsSnapshot: deepClone(source),
    };

    return runtimeConfig;
}

export function applyRuntimeConfigCompatibility(runtimeConfig, targetConfig = CONFIG) {
    if (!runtimeConfig || typeof runtimeConfig !== 'object' || !targetConfig) {
        return targetConfig;
    }

    targetConfig.PLAYER.SPEED = runtimeConfig.player.speed;
    targetConfig.PLAYER.TURN_SPEED = runtimeConfig.player.turnSpeed;
    targetConfig.PLAYER.MODEL_SCALE = runtimeConfig.player.modelScale;
    targetConfig.PLAYER.AUTO_ROLL = runtimeConfig.player.autoRoll;
    targetConfig.PLAYER.VEHICLES = {
        PLAYER_1: runtimeConfig.player.vehicles.PLAYER_1,
        PLAYER_2: runtimeConfig.player.vehicles.PLAYER_2,
    };

    targetConfig.GAMEPLAY.PLANAR_MODE = runtimeConfig.gameplay.planarMode;
    targetConfig.GAMEPLAY.PORTAL_COUNT = runtimeConfig.gameplay.portalCount;
    targetConfig.GAMEPLAY.PLANAR_LEVEL_COUNT = runtimeConfig.gameplay.planarLevelCount;
    targetConfig.GAMEPLAY.PORTAL_BEAMS = runtimeConfig.gameplay.portalBeams;

    targetConfig.TRAIL.WIDTH = runtimeConfig.trail.width;
    targetConfig.TRAIL.GAP_DURATION = runtimeConfig.trail.gapDuration;
    targetConfig.TRAIL.GAP_CHANCE = runtimeConfig.trail.gapChance;

    targetConfig.POWERUP.MAX_ON_FIELD = runtimeConfig.powerup.maxOnField;
    targetConfig.PROJECTILE.COOLDOWN = runtimeConfig.projectile.cooldown;
    targetConfig.BOT.ACTIVE_DIFFICULTY = runtimeConfig.bot.activeDifficulty;
    targetConfig.HOMING.LOCK_ON_ANGLE = runtimeConfig.homing.lockOnAngle;
    if (targetConfig.HUNT) {
        targetConfig.HUNT.ACTIVE_MODE = runtimeConfig?.session?.activeGameMode || GAME_MODE_TYPES.CLASSIC;
        targetConfig.HUNT.RESPAWN_ENABLED = !!runtimeConfig?.hunt?.respawnEnabled;
    }

    return targetConfig;
}
