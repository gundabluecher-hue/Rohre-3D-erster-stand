import { CONFIG } from './Config.js';
import { GAME_MODE_TYPES, isHuntMode, resolveActiveGameMode } from '../hunt/HuntMode.js';
import { BOT_POLICY_TYPES } from '../entities/ai/BotPolicyTypes.js';
import {
    clampSettingValue,
    createControlBindingsSnapshot,
    SETTINGS_LIMITS,
} from './config/SettingsRuntimeContract.js';
import { normalizeSessionType } from '../ui/menu/MenuDraftStore.js';

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function resolveBotDifficulty(requestedDifficulty, botConfig) {
    const botDefaults = botConfig || CONFIG.BOT;
    const fallback = botDefaults.DEFAULT_DIFFICULTY || 'NORMAL';
    const candidate = String(requestedDifficulty || fallback).toUpperCase();
    return Object.prototype.hasOwnProperty.call(botDefaults.DIFFICULTY_PROFILES || {}, candidate)
        ? candidate
        : fallback;
}

export const BOT_POLICY_STRATEGIES = Object.freeze({
    RULE_BASED: 'rule-based',
    BRIDGE: 'bridge',
    AUTO: 'auto',
});
const BOT_POLICY_STRATEGY_SET = new Set(Object.values(BOT_POLICY_STRATEGIES));

export function normalizeBotPolicyStrategy(strategy, fallback = BOT_POLICY_STRATEGIES.AUTO) {
    const normalizedFallback = BOT_POLICY_STRATEGY_SET.has(String(fallback || '').trim().toLowerCase())
        ? String(fallback).trim().toLowerCase()
        : BOT_POLICY_STRATEGIES.AUTO;
    const candidate = typeof strategy === 'string' ? strategy.trim().toLowerCase() : '';
    return BOT_POLICY_STRATEGY_SET.has(candidate) ? candidate : normalizedFallback;
}

export function resolveBotPolicyType(strategy, activeGameMode, { huntFeatureEnabled = true } = {}) {
    const normalizedStrategy = normalizeBotPolicyStrategy(strategy, BOT_POLICY_STRATEGIES.AUTO);
    const huntModeActive = isHuntMode(activeGameMode, huntFeatureEnabled);

    if (normalizedStrategy === BOT_POLICY_STRATEGIES.BRIDGE) {
        return huntModeActive ? BOT_POLICY_TYPES.HUNT_BRIDGE : BOT_POLICY_TYPES.CLASSIC_BRIDGE;
    }
    if (normalizedStrategy === BOT_POLICY_STRATEGIES.RULE_BASED) {
        return BOT_POLICY_TYPES.RULE_BASED;
    }
    return huntModeActive ? BOT_POLICY_TYPES.HUNT : BOT_POLICY_TYPES.RULE_BASED;
}

export function createRuntimeConfigSnapshot(settings, { baseConfig = CONFIG } = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const gameplaySource = source.gameplay && typeof source.gameplay === 'object' ? source.gameplay : {};
    const huntSource = source.hunt && typeof source.hunt === 'object' ? source.hunt : {};
    const botBridgeSource = source.botBridge && typeof source.botBridge === 'object' ? source.botBridge : {};

    const sessionType = normalizeSessionType(source?.localSettings?.sessionType || (source.mode === '2p' ? 'splitscreen' : 'single'));
    const mode = sessionType === 'splitscreen' ? '2p' : '1p';
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
    const botPolicyStrategy = normalizeBotPolicyStrategy(source.botPolicyStrategy, BOT_POLICY_STRATEGIES.AUTO);
    const botPolicyType = resolveBotPolicyType(botPolicyStrategy, activeGameMode, { huntFeatureEnabled });

    const runtimeConfig = {
        session: {
            sessionType,
            mode,
            numHumans,
            numBots: clampSettingValue(source.numBots, SETTINGS_LIMITS.session.numBots, 0),
            winsNeeded: clampSettingValue(source.winsNeeded, SETTINGS_LIMITS.session.winsNeeded, 5),
            mapKey: String(source.mapKey || 'standard'),
            portalsEnabled: !!source.portalsEnabled,
            activeGameMode,
        },
        player: {
            speed: clampSettingValue(gameplaySource.speed, SETTINGS_LIMITS.gameplay.speed, playerDefaults.SPEED),
            turnSpeed: clampSettingValue(gameplaySource.turnSensitivity, SETTINGS_LIMITS.gameplay.turnSensitivity, playerDefaults.TURN_SPEED),
            modelScale: clampSettingValue(gameplaySource.planeScale, SETTINGS_LIMITS.gameplay.planeScale, playerDefaults.MODEL_SCALE),
            autoRoll: typeof source.autoRoll === 'boolean' ? source.autoRoll : !!playerDefaults.AUTO_ROLL,
            vehicles: {
                PLAYER_1: source?.vehicles?.PLAYER_1 || playerDefaults.DEFAULT_VEHICLE_ID || 'ship5',
                PLAYER_2: source?.vehicles?.PLAYER_2 || playerDefaults.DEFAULT_VEHICLE_ID || 'ship5',
            },
        },
        gameplay: {
            planarMode: !!gameplaySource.planarMode,
            portalCount: clampSettingValue(gameplaySource.portalCount, SETTINGS_LIMITS.gameplay.portalCount, gameplayDefaults.PORTAL_COUNT || 0),
            planarLevelCount: clampSettingValue(gameplaySource.planarLevelCount, SETTINGS_LIMITS.gameplay.planarLevelCount, gameplayDefaults.PLANAR_LEVEL_COUNT || 5),
            portalBeams: false,
            planarAimInputSpeed: toNumber(gameplayDefaults.PLANAR_AIM_INPUT_SPEED, 1.5),
            planarAimReturnSpeed: toNumber(gameplayDefaults.PLANAR_AIM_RETURN_SPEED, 0.6),
        },
        trail: {
            width: clampSettingValue(gameplaySource.trailWidth, SETTINGS_LIMITS.gameplay.trailWidth, trailDefaults.WIDTH),
            gapDuration: clampSettingValue(gameplaySource.gapSize, SETTINGS_LIMITS.gameplay.gapSize, trailDefaults.GAP_DURATION),
            gapChance: clampSettingValue(gameplaySource.gapFrequency, SETTINGS_LIMITS.gameplay.gapFrequency, trailDefaults.GAP_CHANCE),
        },
        powerup: {
            maxOnField: clampSettingValue(gameplaySource.itemAmount, SETTINGS_LIMITS.gameplay.itemAmount, powerupDefaults.MAX_ON_FIELD),
        },
        projectile: {
            cooldown: clampSettingValue(gameplaySource.fireRate, SETTINGS_LIMITS.gameplay.fireRate, projectileDefaults.COOLDOWN),
        },
        bot: {
            activeDifficulty: botDifficulty,
            policyStrategy: botPolicyStrategy,
            policyType: botPolicyType,
            trainerBridgeEnabled: !!botBridgeSource.enabled,
            trainerBridgeUrl: typeof botBridgeSource.url === 'string' && botBridgeSource.url.trim()
                ? botBridgeSource.url.trim()
                : 'ws://127.0.0.1:8765',
            trainerBridgeTimeoutMs: clampSettingValue(botBridgeSource.timeoutMs, SETTINGS_LIMITS.botBridge.timeoutMs, 80),
        },
        homing: {
            lockOnAngle: clampSettingValue(gameplaySource.lockOnAngle, SETTINGS_LIMITS.gameplay.lockOnAngle, homingDefaults.LOCK_ON_ANGLE),
        },
        controls: createControlBindingsSnapshot(source.controls, controlsDefaults, { guardCombatConflicts: true }),
        huntCombat: {
            mgTrailAimRadius: clampSettingValue(
                gameplaySource.mgTrailAimRadius,
                SETTINGS_LIMITS.gameplay.mgTrailAimRadius,
                baseConfig?.HUNT?.MG?.TRAIL_HIT_RADIUS ?? CONFIG?.HUNT?.MG?.TRAIL_HIT_RADIUS ?? 0.78
            ),
        },
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
    targetConfig.BOT.ACTIVE_POLICY_STRATEGY = runtimeConfig?.bot?.policyStrategy || BOT_POLICY_STRATEGIES.AUTO;
    targetConfig.BOT.ACTIVE_POLICY_TYPE = runtimeConfig?.bot?.policyType || BOT_POLICY_TYPES.RULE_BASED;
    targetConfig.BOT.TRAINER_BRIDGE_ENABLED = !!runtimeConfig.bot.trainerBridgeEnabled;
    targetConfig.BOT.TRAINER_BRIDGE_URL = runtimeConfig.bot.trainerBridgeUrl;
    targetConfig.BOT.TRAINER_BRIDGE_TIMEOUT_MS = runtimeConfig.bot.trainerBridgeTimeoutMs;
    targetConfig.HOMING.LOCK_ON_ANGLE = runtimeConfig.homing.lockOnAngle;
    if (targetConfig.HUNT) {
        targetConfig.HUNT.ACTIVE_MODE = runtimeConfig?.session?.activeGameMode || GAME_MODE_TYPES.CLASSIC;
        targetConfig.HUNT.RESPAWN_ENABLED = !!runtimeConfig?.hunt?.respawnEnabled;
        if (targetConfig.HUNT.MG && runtimeConfig?.huntCombat) {
            targetConfig.HUNT.MG = {
                ...targetConfig.HUNT.MG,
                TRAIL_HIT_RADIUS: runtimeConfig.huntCombat.mgTrailAimRadius
            };
        }
    }

    return targetConfig;
}
