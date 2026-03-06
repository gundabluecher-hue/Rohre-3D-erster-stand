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
    normalizeGlobalControlBindings,
    SETTINGS_LIMITS,
} from './config/SettingsRuntimeContract.js';
import { ensureMenuContractState } from '../ui/menu/MenuStateContracts.js';
import { resolveMenuAccessContext } from '../ui/menu/MenuAccessPolicy.js';
import {
    applyPresetToSettings,
    capturePresetValuesFromSettings,
    createPresetMetadata,
} from '../ui/menu/MenuPresetApplyOps.js';
import { MenuPresetStore } from '../ui/menu/MenuPresetStore.js';
import { getFixedMenuPresetCatalog } from '../ui/menu/MenuPresetCatalog.js';
import { MENU_SESSION_TYPES } from '../ui/menu/MenuStateContracts.js';
import { MenuDraftStore, normalizeSessionType } from '../ui/menu/MenuDraftStore.js';
import { MenuTextOverrideStore } from '../ui/menu/MenuTextOverrideStore.js';
import { MENU_TEXT_CATALOG } from '../ui/menu/MenuTextCatalog.js';
import { MenuTelemetryStore } from '../ui/menu/MenuTelemetryStore.js';
import {
    applyDeveloperThemeToDocument,
    setDeveloperActorId,
    setDeveloperFixedPresetLock,
    setDeveloperModeEnabled,
    setDeveloperReleasePreviewEnabled,
    setDeveloperTheme,
    setDeveloperVisibilityMode,
} from '../ui/menu/MenuDeveloperModeOps.js';
import { applyMenuCompatibilityRules as applyMenuCompatibilityRuleSet } from '../ui/menu/MenuCompatibilityRules.js';

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

export const GLOBAL_KEY_BIND_ACTIONS = [
    { label: 'Cinematic Kamera (beide Spieler)', key: 'CINEMATIC_TOGGLE' },
];

function normalizeTelemetrySnapshot(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        abortCount: Number.isFinite(Number(source.abortCount)) ? Number(source.abortCount) : 0,
        backtrackCount: Number.isFinite(Number(source.backtrackCount)) ? Number(source.backtrackCount) : 0,
        quickStartCount: Number.isFinite(Number(source.quickStartCount)) ? Number(source.quickStartCount) : 0,
        startAttempts: Number.isFinite(Number(source.startAttempts)) ? Number(source.startAttempts) : 0,
        lastEvents: Array.isArray(source.events) ? source.events.slice(-15) : [],
    };
}

function normalizePresetId(rawValue) {
    const base = String(rawValue || '')
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9\-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
    return base || '';
}

export class SettingsManager {
    constructor() {
        this.store = new SettingsStore({
            sanitizeSettings: (settings) => this.sanitizeSettings(settings),
            createDefaultSettings: () => this.createDefaultSettings(),
        });
        this.menuPresetStore = new MenuPresetStore({
            fixedCatalog: getFixedMenuPresetCatalog(),
        });
        this.menuDraftStore = new MenuDraftStore();
        this.menuTextOverrideStore = new MenuTextOverrideStore();
        this.menuTelemetryStore = new MenuTelemetryStore();
    }

    createDefaultSettings() {
        const defaults = {
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
        return ensureMenuContractState(defaults);
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
        const migratedSessionType = normalizeSessionType(
            src?.localSettings?.sessionType || (src.mode === '2p' ? MENU_SESSION_TYPES.SPLITSCREEN : MENU_SESSION_TYPES.SINGLE)
        );

        merged.mode = migratedSessionType === MENU_SESSION_TYPES.SPLITSCREEN ? '2p' : '1p';
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
        merged.controls.GLOBAL = normalizeGlobalControlBindings(src?.controls?.GLOBAL, defaults.controls.GLOBAL);

        if (src?.menuFeatureFlags && typeof src.menuFeatureFlags === 'object') {
            merged.menuFeatureFlags = { ...src.menuFeatureFlags };
        }
        if (src?.menuContracts && typeof src.menuContracts === 'object') {
            merged.menuContracts = { ...src.menuContracts };
        }
        if (src?.matchSettings && typeof src.matchSettings === 'object') {
            merged.matchSettings = { ...src.matchSettings };
        }
        if (src?.playerLoadout && typeof src.playerLoadout === 'object') {
            merged.playerLoadout = { ...src.playerLoadout };
        }
        if (src?.localSettings && typeof src.localSettings === 'object') {
            merged.localSettings = { ...src.localSettings };
        }

        ensureMenuContractState(merged);
        merged.localSettings.sessionType = migratedSessionType;
        merged.localSettings.modePath = String(merged.localSettings.modePath || 'normal').toLowerCase();
        if (merged.localSettings.modePath !== 'quick_action'
            && merged.localSettings.modePath !== 'arcade'
            && merged.localSettings.modePath !== 'fight'
            && merged.localSettings.modePath !== 'normal') {
            merged.localSettings.modePath = 'normal';
        }
        applyMenuCompatibilityRuleSet(merged);
        return merged;
    }

    loadSettings() {
        return this.store.loadSettings();
    }

    saveSettings(settings) {
        return this.store.saveSettings(settings);
    }

    listMenuPresets() {
        return this.menuPresetStore.listPresets();
    }

    saveSessionDraft(settings, sessionType) {
        ensureMenuContractState(settings);
        const normalizedSessionType = normalizeSessionType(sessionType, settings?.localSettings?.sessionType || MENU_SESSION_TYPES.SINGLE);
        const result = this.menuDraftStore.saveDraft(normalizedSessionType, settings);
        if (result.success) {
            if (!settings.localSettings.draftStateBySessionType || typeof settings.localSettings.draftStateBySessionType !== 'object') {
                settings.localSettings.draftStateBySessionType = {};
            }
            settings.localSettings.draftStateBySessionType[normalizedSessionType] = {
                updatedAt: new Date().toISOString(),
                mapKey: String(settings.mapKey || ''),
                vehicleP1: String(settings?.vehicles?.PLAYER_1 || ''),
                vehicleP2: String(settings?.vehicles?.PLAYER_2 || ''),
            };
        }
        return result;
    }

    applySessionDraft(settings, sessionType) {
        ensureMenuContractState(settings);
        return this.menuDraftStore.applyDraft(settings, sessionType);
    }

    switchSessionType(settings, nextSessionType) {
        ensureMenuContractState(settings);
        const currentSessionType = normalizeSessionType(settings?.localSettings?.sessionType, MENU_SESSION_TYPES.SINGLE);
        const targetSessionType = normalizeSessionType(nextSessionType, currentSessionType);
        if (targetSessionType === currentSessionType) {
            return {
                success: true,
                changed: false,
                targetSessionType,
                loadedDraft: false,
            };
        }

        this.saveSessionDraft(settings, currentSessionType);
        const draftResult = this.applySessionDraft(settings, targetSessionType);
        settings.localSettings.sessionType = targetSessionType;
        settings.mode = targetSessionType === MENU_SESSION_TYPES.SPLITSCREEN ? '2p' : '1p';
        if (!draftResult.success) {
            settings.localSettings.modePath = 'normal';
        }

        return {
            success: true,
            changed: true,
            targetSessionType,
            loadedDraft: draftResult.success,
            draftResult,
        };
    }

    applyMenuCompatibilityRules(settings, options = {}) {
        ensureMenuContractState(settings);
        return applyMenuCompatibilityRuleSet(settings, options);
    }

    applyMenuPreset(settings, presetId, accessContext = null) {
        const normalizedPresetId = String(presetId || '').trim();
        if (!normalizedPresetId) {
            return { success: false, reason: 'invalid_preset_id' };
        }
        const preset = this.menuPresetStore.getPresetById(normalizedPresetId);
        if (!preset) {
            return { success: false, reason: 'preset_not_found' };
        }

        ensureMenuContractState(settings);
        const resolvedContext = accessContext && typeof accessContext === 'object'
            ? accessContext
            : resolveMenuAccessContext(settings);
        const result = applyPresetToSettings({
            settings,
            preset,
            accessContext: resolvedContext,
            allowOpenPresetEditing: settings?.menuFeatureFlags?.allowOpenPresetEditing !== false,
        });
        const compatibilityResult = this.applyMenuCompatibilityRules(settings, { accessContext: resolvedContext });
        ensureMenuContractState(settings);
        const changedKeys = Array.from(new Set([
            ...(Array.isArray(result.changedKeys) ? result.changedKeys : []),
            ...(Array.isArray(compatibilityResult.changedKeys) ? compatibilityResult.changedKeys : []),
        ]));

        return {
            success: result.reason !== 'invalid_payload',
            preset,
            ...result,
            changedKeys,
            compatibilityResult,
        };
    }

    saveMenuPreset(settings, options = {}, accessContext = null) {
        ensureMenuContractState(settings);
        const resolvedContext = accessContext && typeof accessContext === 'object'
            ? accessContext
            : resolveMenuAccessContext(settings);
        const kind = options.kind === 'fixed' ? 'fixed' : 'open';
        if (kind === 'fixed' && !resolvedContext.isOwner) {
            return { success: false, reason: 'owner_required' };
        }

        const requestedName = String(options.name || '').trim();
        const requestedId = String(options.id || '').trim();
        const derivedId = normalizePresetId(requestedId || requestedName || `preset-${Date.now()}`);
        if (!derivedId) {
            return { success: false, reason: 'invalid_preset_id' };
        }

        const metadata = createPresetMetadata({
            id: derivedId,
            kind,
            ownerId: resolvedContext.ownerId || 'owner',
            lockedFields: Array.isArray(options.lockedFields) ? options.lockedFields : [],
            sourcePresetId: options.sourcePresetId || settings?.matchSettings?.activePresetId || '',
            createdAt: options.createdAt,
            updatedAt: options.updatedAt,
            timestamp: options.timestamp,
        });
        const preset = {
            id: metadata.id,
            name: requestedName || metadata.id,
            description: String(options.description || '').trim(),
            metadata,
            values: capturePresetValuesFromSettings(settings),
        };
        return this.menuPresetStore.upsertPreset(preset, resolvedContext);
    }

    deleteMenuPreset(presetId, settings, accessContext = null) {
        ensureMenuContractState(settings);
        const resolvedContext = accessContext && typeof accessContext === 'object'
            ? accessContext
            : resolveMenuAccessContext(settings);
        return this.menuPresetStore.deletePreset(presetId, resolvedContext);
    }

    setDeveloperMode(settings, enabled, accessContext = null) {
        return setDeveloperModeEnabled(settings, enabled, accessContext);
    }

    setDeveloperTheme(settings, themeId, accessContext = null) {
        const result = setDeveloperTheme(settings, themeId, accessContext);
        if (!result.success) return result;
        applyDeveloperThemeToDocument(settings?.localSettings?.developerThemeId);
        return result;
    }

    setDeveloperFixedPresetLock(settings, enabled, accessContext = null) {
        return setDeveloperFixedPresetLock(settings, enabled, accessContext);
    }

    setDeveloperActor(settings, actorId, accessContext = null) {
        return setDeveloperActorId(settings, actorId, accessContext);
    }

    setDeveloperReleasePreview(settings, enabled, accessContext = null) {
        return setDeveloperReleasePreviewEnabled(settings, enabled, accessContext);
    }

    setDeveloperVisibility(settings, mode, accessContext = null) {
        return setDeveloperVisibilityMode(settings, mode, accessContext);
    }

    listMenuTextOverrides() {
        return this.menuTextOverrideStore.listOverrides();
    }

    setMenuTextOverride(textId, textValue) {
        const normalizedTextId = String(textId || '').trim();
        if (!normalizedTextId || !Object.prototype.hasOwnProperty.call(MENU_TEXT_CATALOG, normalizedTextId)) {
            return { success: false, reason: 'unknown_text_id' };
        }
        return this.menuTextOverrideStore.setOverride(textId, textValue);
    }

    clearMenuTextOverride(textId) {
        const normalizedTextId = String(textId || '').trim();
        if (!normalizedTextId || !Object.prototype.hasOwnProperty.call(MENU_TEXT_CATALOG, normalizedTextId)) {
            return { success: false, reason: 'unknown_text_id' };
        }
        return this.menuTextOverrideStore.clearOverride(textId);
    }

    getMenuTelemetrySnapshot(settings = null) {
        const snapshot = normalizeTelemetrySnapshot(this.menuTelemetryStore.getSnapshot());
        if (settings && typeof settings === 'object') {
            ensureMenuContractState(settings);
            settings.localSettings.telemetryState = {
                ...settings.localSettings.telemetryState,
                ...snapshot,
            };
        }
        return snapshot;
    }

    recordMenuTelemetry(settings, eventType, payload = null) {
        const snapshot = normalizeTelemetrySnapshot(this.menuTelemetryStore.recordEvent(eventType, payload));
        if (settings && typeof settings === 'object') {
            ensureMenuContractState(settings);
            settings.localSettings.telemetryState = {
                ...settings.localSettings.telemetryState,
                ...snapshot,
            };
        }
        return snapshot;
    }

    createRuntimeConfig(settings) {
        return createRuntimeConfigSnapshot(settings, { baseConfig: CONFIG });
    }
}
