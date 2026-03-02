// ============================================
// SettingsManager.js - business logic for settings
// ============================================

import { CONFIG } from './Config.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { SettingsStore } from '../ui/SettingsStore.js';
import { createRuntimeConfigSnapshot } from './RuntimeConfig.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';

function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

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
        return {
            PLAYER_1: { ...base.PLAYER_1 },
            PLAYER_2: { ...base.PLAYER_2 },
        };
    }

    normalizePlayerControls(source, fallback) {
        const src = source || {};
        const shoot = src.SHOOT || fallback.SHOOT;
        let shootMg = src.SHOOT_MG || fallback.SHOOT_MG;
        let drop = src.DROP || fallback.DROP;

        if (shootMg === shoot) {
            const fallbackShootMg = fallback.SHOOT_MG;
            if (fallbackShootMg && fallbackShootMg !== shoot) {
                shootMg = fallbackShootMg;
            }
        }
        if (drop === shootMg) {
            const fallbackDrop = fallback.DROP;
            if (fallbackDrop && fallbackDrop !== shoot && fallbackDrop !== shootMg) {
                drop = fallbackDrop;
            }
        }

        return {
            UP: src.UP || fallback.UP,
            DOWN: src.DOWN || fallback.DOWN,
            LEFT: src.LEFT || fallback.LEFT,
            RIGHT: src.RIGHT || fallback.RIGHT,
            ROLL_LEFT: src.ROLL_LEFT || fallback.ROLL_LEFT,
            ROLL_RIGHT: src.ROLL_RIGHT || fallback.ROLL_RIGHT,
            BOOST: src.BOOST || fallback.BOOST,
            SHOOT: shoot,
            SHOOT_MG: shootMg,
            NEXT_ITEM: src.NEXT_ITEM || fallback.NEXT_ITEM,
            DROP: drop,
            CAMERA: src.CAMERA || fallback.CAMERA,
        };
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
        merged.numBots = clamp(parseInt(src.numBots ?? defaults.numBots, 10), 0, 8);
        merged.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(src.botDifficulty)
            ? src.botDifficulty
            : defaults.botDifficulty;
        merged.winsNeeded = clamp(parseInt(src.winsNeeded ?? defaults.winsNeeded, 10), 1, 15);
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

        merged.gameplay.speed = clamp(parseFloat(src?.gameplay?.speed ?? defaults.gameplay.speed), 8, 40);
        merged.gameplay.turnSensitivity = clamp(parseFloat(src?.gameplay?.turnSensitivity ?? defaults.gameplay.turnSensitivity), 0.8, 5);
        merged.gameplay.planeScale = clamp(parseFloat(src?.gameplay?.planeScale ?? defaults.gameplay.planeScale), 0.6, 2.0);
        merged.gameplay.trailWidth = clamp(parseFloat(src?.gameplay?.trailWidth ?? defaults.gameplay.trailWidth), 0.2, 2.5);
        merged.gameplay.gapSize = clamp(parseFloat(src?.gameplay?.gapSize ?? defaults.gameplay.gapSize), 0.05, 1.5);
        merged.gameplay.gapFrequency = clamp(parseFloat(src?.gameplay?.gapFrequency ?? defaults.gameplay.gapFrequency), 0, 0.25);
        merged.gameplay.itemAmount = clamp(parseInt(src?.gameplay?.itemAmount ?? defaults.gameplay.itemAmount, 10), 1, 20);
        merged.gameplay.fireRate = clamp(parseFloat(src?.gameplay?.fireRate ?? defaults.gameplay.fireRate), 0.1, 2.0);
        merged.gameplay.lockOnAngle = clamp(parseInt(src?.gameplay?.lockOnAngle ?? defaults.gameplay.lockOnAngle, 10), 5, 45);
        merged.gameplay.planarMode = !!(src?.gameplay?.planarMode ?? defaults.gameplay.planarMode);
        merged.gameplay.portalCount = clamp(parseInt(src?.gameplay?.portalCount ?? defaults.gameplay.portalCount, 10), 0, 20);
        merged.gameplay.planarLevelCount = clamp(parseInt(src?.gameplay?.planarLevelCount ?? defaults.gameplay.planarLevelCount, 10), 2, 10);
        merged.gameplay.portalBeams = false;

        merged.controls.PLAYER_1 = this.normalizePlayerControls(src?.controls?.PLAYER_1, defaults.controls.PLAYER_1);
        merged.controls.PLAYER_2 = this.normalizePlayerControls(src?.controls?.PLAYER_2, defaults.controls.PLAYER_2);

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
