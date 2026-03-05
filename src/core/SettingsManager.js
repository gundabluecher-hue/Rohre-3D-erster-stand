// ============================================
// SettingsManager.js - business logic for settings
// ============================================

import { CONFIG } from './Config.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { SettingsStore } from '../ui/SettingsStore.js';
import {
    BOT_POLICY_STRATEGIES,
    createRuntimeConfigSnapshot,
    normalizeBotPolicyStrategy,
} from './RuntimeConfig.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';
import {
    clampSettingValue,
    createControlBindingsSnapshot,
    normalizeControlBindings,
    SETTINGS_LIMITS,
} from './config/SettingsRuntimeContract.js';

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export const KEY_BIND_ACTIONS = [
    { label: 'Pitch Hoch', key: 'UP' },
    { label: 'Pitch Runter', key: 'DOWN' },
    { label: 'Links (Gier)', key: 'LEFT' },
    { label: 'Rechts (Gier)', key: 'RIGHT' },
    { label: 'Rollen Links', key: 'ROLL_LEFT' },
    { label: 'Rollen Rechts', key: 'ROLL_RIGHT' },
    { label: 'Boost', key: 'BOOST' },
    { label: 'Schiessen (Item)', key: 'SHOOT' },
    { label: 'MG Schiessen', key: 'SHOOT_MG' },
    { label: 'Item Abwerfen', key: 'DROP' },
    { label: 'Item Wechseln', key: 'NEXT_ITEM' },
    { label: 'Kamera', key: 'CAMERA' },
];

export class SettingsManager {
    constructor() {
        this.store = new SettingsStore({
            sanitizeSettings: (settings) => this.sanitizeSettings(settings),
            createDefaultSettings: () => this.createDefaultSettings(),
        });
    }

    createDefaultSettings() {
        return {
            mode: '1p',
            gameMode: resolveActiveGameMode(CONFIG.HUNT?.DEFAULT_MODE, CONFIG.HUNT?.ENABLED !== false),
            mapKey: 'standard',
            numBots: 1,
            botDifficulty: 'NORMAL',
            botPolicyStrategy: BOT_POLICY_STRATEGIES.AUTO,
            winsNeeded: 5,
            autoRoll: true,
            invertPitch: {
                PLAYER_1: false,
                PLAYER_2: false,
            },
            cockpitCamera: {
                PLAYER_1: false,
                PLAYER_2: false,
            },
            vehicles: {
                PLAYER_1: 'ship5',
                PLAYER_2: 'ship5',
            },
            portalsEnabled: true,
            hunt: {
                respawnEnabled: !!CONFIG.HUNT?.DEFAULT_RESPAWN_ENABLED,
            },
            gameplay: {
                speed: 18,
                turnSensitivity: 2.2,
                planeScale: 1.0,
                trailWidth: 0.6,
                gapSize: 0.3,
                gapFrequency: 0.02,
                itemAmount: 8,
                fireRate: 0.45,
                lockOnAngle: 15,
                mgTrailAimRadius: clampSettingValue(
                    parseFloat(CONFIG?.HUNT?.MG?.TRAIL_HIT_RADIUS ?? 0.78),
                    SETTINGS_LIMITS.gameplay.mgTrailAimRadius,
                    0.78
                ),
                planarMode: false,
                portalCount: 0,
                planarLevelCount: 5,
                portalBeams: false,
            },
            controls: this.cloneDefaultControls(),
        };
    }

    cloneDefaultControls() {
        const base = deepClone(CONFIG.KEYS);
        return createControlBindingsSnapshot(base, base);
    }

    sanitizeSettings(saved) {
        const defaults = this.createDefaultSettings();
        const src = saved && typeof saved === 'object' ? saved : {};
        const merged = deepClone(defaults);
        const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;

        merged.mode = src.mode === '2p' ? '2p' : '1p';
        merged.gameMode = resolveActiveGameMode(src.gameMode, huntFeatureEnabled);
        const requestedMapKey = String(src.mapKey || '');
        merged.mapKey = (requestedMapKey === CUSTOM_MAP_KEY || CONFIG.MAPS[requestedMapKey])
            ? requestedMapKey
            : defaults.mapKey;
        merged.numBots = clampSettingValue(
            src.numBots ?? defaults.numBots,
            SETTINGS_LIMITS.session.numBots,
            defaults.numBots
        );
        merged.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(src.botDifficulty)
            ? src.botDifficulty
            : defaults.botDifficulty;
        merged.botPolicyStrategy = normalizeBotPolicyStrategy(src.botPolicyStrategy, defaults.botPolicyStrategy);
        merged.winsNeeded = clampSettingValue(
            src.winsNeeded ?? defaults.winsNeeded,
            SETTINGS_LIMITS.session.winsNeeded,
            defaults.winsNeeded
        );
        merged.autoRoll = typeof src.autoRoll === 'boolean' ? src.autoRoll : defaults.autoRoll;

        merged.invertPitch.PLAYER_1 = !!src?.invertPitch?.PLAYER_1;
        merged.invertPitch.PLAYER_2 = !!src?.invertPitch?.PLAYER_2;
        merged.cockpitCamera.PLAYER_1 = !!src?.cockpitCamera?.PLAYER_1;
        merged.cockpitCamera.PLAYER_2 = !!src?.cockpitCamera?.PLAYER_2;

        if (!merged.vehicles) merged.vehicles = { PLAYER_1: 'ship5', PLAYER_2: 'ship5' };
        merged.vehicles.PLAYER_1 = src?.vehicles?.PLAYER_1 || 'ship5';
        merged.vehicles.PLAYER_2 = src?.vehicles?.PLAYER_2 || 'ship5';

        merged.portalsEnabled = src?.portalsEnabled !== undefined ? !!src.portalsEnabled : defaults.portalsEnabled;
        merged.hunt.respawnEnabled = !!(src?.hunt?.respawnEnabled ?? defaults.hunt.respawnEnabled);
        if (merged.gameMode !== GAME_MODE_TYPES.HUNT) {
            merged.hunt.respawnEnabled = false;
        }

        merged.gameplay.speed = clampSettingValue(src?.gameplay?.speed ?? defaults.gameplay.speed, SETTINGS_LIMITS.gameplay.speed, defaults.gameplay.speed);
        merged.gameplay.turnSensitivity = clampSettingValue(src?.gameplay?.turnSensitivity ?? defaults.gameplay.turnSensitivity, SETTINGS_LIMITS.gameplay.turnSensitivity, defaults.gameplay.turnSensitivity);
        merged.gameplay.planeScale = clampSettingValue(src?.gameplay?.planeScale ?? defaults.gameplay.planeScale, SETTINGS_LIMITS.gameplay.planeScale, defaults.gameplay.planeScale);
        merged.gameplay.trailWidth = clampSettingValue(src?.gameplay?.trailWidth ?? defaults.gameplay.trailWidth, SETTINGS_LIMITS.gameplay.trailWidth, defaults.gameplay.trailWidth);
        merged.gameplay.gapSize = clampSettingValue(src?.gameplay?.gapSize ?? defaults.gameplay.gapSize, SETTINGS_LIMITS.gameplay.gapSize, defaults.gameplay.gapSize);
        merged.gameplay.gapFrequency = clampSettingValue(src?.gameplay?.gapFrequency ?? defaults.gameplay.gapFrequency, SETTINGS_LIMITS.gameplay.gapFrequency, defaults.gameplay.gapFrequency);
        merged.gameplay.itemAmount = clampSettingValue(src?.gameplay?.itemAmount ?? defaults.gameplay.itemAmount, SETTINGS_LIMITS.gameplay.itemAmount, defaults.gameplay.itemAmount);
        merged.gameplay.fireRate = clampSettingValue(src?.gameplay?.fireRate ?? defaults.gameplay.fireRate, SETTINGS_LIMITS.gameplay.fireRate, defaults.gameplay.fireRate);
        merged.gameplay.lockOnAngle = clampSettingValue(src?.gameplay?.lockOnAngle ?? defaults.gameplay.lockOnAngle, SETTINGS_LIMITS.gameplay.lockOnAngle, defaults.gameplay.lockOnAngle);
        merged.gameplay.mgTrailAimRadius = clampSettingValue(
            src?.gameplay?.mgTrailAimRadius ?? defaults.gameplay.mgTrailAimRadius,
            SETTINGS_LIMITS.gameplay.mgTrailAimRadius,
            defaults.gameplay.mgTrailAimRadius
        );
        merged.gameplay.planarMode = !!(src?.gameplay?.planarMode ?? defaults.gameplay.planarMode);
        merged.gameplay.portalCount = clampSettingValue(src?.gameplay?.portalCount ?? defaults.gameplay.portalCount, SETTINGS_LIMITS.gameplay.portalCount, defaults.gameplay.portalCount);
        merged.gameplay.planarLevelCount = clampSettingValue(src?.gameplay?.planarLevelCount ?? defaults.gameplay.planarLevelCount, SETTINGS_LIMITS.gameplay.planarLevelCount, defaults.gameplay.planarLevelCount);
        merged.gameplay.portalBeams = false;

        merged.controls.PLAYER_1 = normalizeControlBindings(src?.controls?.PLAYER_1, defaults.controls.PLAYER_1, { guardCombatConflicts: true });
        merged.controls.PLAYER_2 = normalizeControlBindings(src?.controls?.PLAYER_2, defaults.controls.PLAYER_2, { guardCombatConflicts: true });

        return merged;
    }

    loadSettings() {
        return this.store.loadSettings();
    }

    saveSettings(settings) {
        return this.store.saveSettings(settings);
    }

    createRuntimeConfig(settings) {
        return createRuntimeConfigSnapshot(settings, { baseConfig: CONFIG });
    }
}
