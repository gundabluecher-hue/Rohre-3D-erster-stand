export const MENU_STATE_SCHEMA_VERSION = 'menu-state.v1';
export const MATCH_SETTINGS_SCHEMA_VERSION = 'match-settings.v1';
export const PLAYER_LOADOUT_SCHEMA_VERSION = 'player-loadout.v1';
export const LOCAL_SETTINGS_SCHEMA_VERSION = 'local-settings.v1';
export const MENU_LIFECYCLE_EVENT_CONTRACT_VERSION = 'lifecycle.v1';

export const DEFAULT_MENU_FEATURE_FLAGS = Object.freeze({
    menuV26Enabled: true,
    multiplayerStubEnabled: true,
    developerModeEnabled: true,
    allowOpenPresetEditing: true,
});

export const MENU_DEVELOPER_ACCESS_MODES = Object.freeze({
    HIDDEN_FOR_PLAYERS: 'hidden_for_players',
    OWNER_ONLY: 'owner_only',
    OPEN: 'open',
});

const VALID_DEVELOPER_ACCESS_MODE_SET = new Set(Object.values(MENU_DEVELOPER_ACCESS_MODES));

function normalizeBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value, fallback) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
}

export function createMenuFeatureFlags(flags = null) {
    const source = flags && typeof flags === 'object' ? flags : {};
    return {
        menuV26Enabled: normalizeBoolean(source.menuV26Enabled, DEFAULT_MENU_FEATURE_FLAGS.menuV26Enabled),
        multiplayerStubEnabled: normalizeBoolean(source.multiplayerStubEnabled, DEFAULT_MENU_FEATURE_FLAGS.multiplayerStubEnabled),
        developerModeEnabled: normalizeBoolean(source.developerModeEnabled, DEFAULT_MENU_FEATURE_FLAGS.developerModeEnabled),
        allowOpenPresetEditing: normalizeBoolean(source.allowOpenPresetEditing, DEFAULT_MENU_FEATURE_FLAGS.allowOpenPresetEditing),
    };
}

export function createMenuContractState(contractState = null) {
    const source = contractState && typeof contractState === 'object' ? contractState : {};
    return {
        schemaVersion: MENU_STATE_SCHEMA_VERSION,
        matchSettingsSchemaVersion: normalizeString(source.matchSettingsSchemaVersion, MATCH_SETTINGS_SCHEMA_VERSION),
        playerLoadoutSchemaVersion: normalizeString(source.playerLoadoutSchemaVersion, PLAYER_LOADOUT_SCHEMA_VERSION),
        localSettingsSchemaVersion: normalizeString(source.localSettingsSchemaVersion, LOCAL_SETTINGS_SCHEMA_VERSION),
        lifecycleContractVersion: normalizeString(source.lifecycleContractVersion, MENU_LIFECYCLE_EVENT_CONTRACT_VERSION),
    };
}

function normalizeLocalSettingsState(localSettings = null) {
    const source = localSettings && typeof localSettings === 'object' ? localSettings : {};
    const ownerId = normalizeString(source.ownerId, 'owner');
    const actorId = normalizeString(source.actorId, ownerId);
    const requestedAccessMode = normalizeString(source.developerModeVisibility, MENU_DEVELOPER_ACCESS_MODES.OWNER_ONLY);
    const developerModeVisibility = VALID_DEVELOPER_ACCESS_MODE_SET.has(requestedAccessMode)
        ? requestedAccessMode
        : MENU_DEVELOPER_ACCESS_MODES.OWNER_ONLY;

    return {
        schemaVersion: LOCAL_SETTINGS_SCHEMA_VERSION,
        ownerId,
        actorId,
        developerModeVisibility,
        developerModeEnabled: normalizeBoolean(source.developerModeEnabled, false),
        developerThemeId: normalizeString(source.developerThemeId, 'classic-console'),
        fixedPresetId: normalizeString(source.fixedPresetId, ''),
        fixedPresetLockEnabled: normalizeBoolean(source.fixedPresetLockEnabled, false),
    };
}

function normalizeMatchSettingsContract(matchSettings = null) {
    const source = matchSettings && typeof matchSettings === 'object' ? matchSettings : {};
    return {
        schemaVersion: MATCH_SETTINGS_SCHEMA_VERSION,
        activePresetId: normalizeString(source.activePresetId, ''),
        activePresetKind: normalizeString(source.activePresetKind, ''),
        activePresetSourceId: normalizeString(source.activePresetSourceId, ''),
    };
}

function normalizePlayerLoadoutContract(playerLoadout = null) {
    const source = playerLoadout && typeof playerLoadout === 'object' ? playerLoadout : {};
    return {
        schemaVersion: PLAYER_LOADOUT_SCHEMA_VERSION,
        presetId: normalizeString(source.presetId, ''),
        presetKind: normalizeString(source.presetKind, ''),
    };
}

export function ensureMenuContractState(settings) {
    if (!settings || typeof settings !== 'object') return settings;

    settings.menuFeatureFlags = createMenuFeatureFlags(settings.menuFeatureFlags);
    settings.menuContracts = createMenuContractState(settings.menuContracts);
    settings.matchSettings = normalizeMatchSettingsContract(settings.matchSettings);
    settings.playerLoadout = normalizePlayerLoadoutContract(settings.playerLoadout);
    settings.localSettings = normalizeLocalSettingsState(settings.localSettings);
    return settings;
}

export function createSettingsDomainSnapshot(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    ensureMenuContractState(source);

    return {
        matchSettings: {
            schemaVersion: MATCH_SETTINGS_SCHEMA_VERSION,
            mode: source.mode,
            gameMode: source.gameMode,
            mapKey: source.mapKey,
            numBots: source.numBots,
            botDifficulty: source.botDifficulty,
            winsNeeded: source.winsNeeded,
            autoRoll: source.autoRoll,
            portalsEnabled: source.portalsEnabled,
            hunt: source.hunt ? { ...source.hunt } : { respawnEnabled: false },
            gameplay: source.gameplay ? { ...source.gameplay } : {},
            preset: { ...source.matchSettings },
        },
        playerLoadout: {
            schemaVersion: PLAYER_LOADOUT_SCHEMA_VERSION,
            vehicles: source.vehicles ? { ...source.vehicles } : {},
            invertPitch: source.invertPitch ? { ...source.invertPitch } : {},
            cockpitCamera: source.cockpitCamera ? { ...source.cockpitCamera } : {},
            preset: { ...source.playerLoadout },
        },
        localSettings: {
            schemaVersion: LOCAL_SETTINGS_SCHEMA_VERSION,
            controls: source.controls ? { ...source.controls } : {},
            menuFeatureFlags: { ...source.menuFeatureFlags },
            state: { ...source.localSettings },
        },
    };
}

export function buildMenuLifecycleEventPayload(eventType, payload = null) {
    const sourcePayload = payload && typeof payload === 'object' ? payload : {};
    return {
        contractVersion: MENU_LIFECYCLE_EVENT_CONTRACT_VERSION,
        eventType: normalizeString(eventType, 'unknown'),
        ...sourcePayload,
    };
}
