export const SETTINGS_CHANGE_KEYS = Object.freeze({
    SESSION_TYPE: 'session.type',
    MODE_PATH: 'session.modePath',
    LOCAL_THEME_MODE: 'local.themeMode',
    MODE: 'mode',
    GAME_MODE: 'gameMode',
    MAP_KEY: 'mapKey',
    BOTS_COUNT: 'bots.count',
    BOTS_DIFFICULTY: 'bots.difficulty',
    RULES_WINS_NEEDED: 'rules.winsNeeded',
    RULES_AUTO_ROLL: 'rules.autoRoll',
    RULES_INVERT_P1: 'rules.invertPitch.player1',
    RULES_INVERT_P2: 'rules.invertPitch.player2',
    RULES_COCKPIT_P1: 'rules.cockpitCamera.player1',
    RULES_COCKPIT_P2: 'rules.cockpitCamera.player2',
    RULES_PORTALS_ENABLED: 'rules.portalsEnabled',
    VEHICLES_PLAYER_1: 'vehicles.player1',
    VEHICLES_PLAYER_2: 'vehicles.player2',
    HUNT_RESPAWN_ENABLED: 'hunt.respawnEnabled',
    GAMEPLAY_SPEED: 'gameplay.speed',
    GAMEPLAY_TURN_SENSITIVITY: 'gameplay.turnSensitivity',
    GAMEPLAY_PLANE_SCALE: 'gameplay.planeScale',
    GAMEPLAY_TRAIL_WIDTH: 'gameplay.trailWidth',
    GAMEPLAY_GAP_SIZE: 'gameplay.gapSize',
    GAMEPLAY_GAP_FREQUENCY: 'gameplay.gapFrequency',
    GAMEPLAY_ITEM_AMOUNT: 'gameplay.itemAmount',
    GAMEPLAY_FIRE_RATE: 'gameplay.fireRate',
    GAMEPLAY_LOCK_ON_ANGLE: 'gameplay.lockOnAngle',
    GAMEPLAY_MG_TRAIL_AIM_RADIUS: 'gameplay.mgTrailAimRadius',
    GAMEPLAY_PLANAR_MODE: 'gameplay.planarMode',
    GAMEPLAY_PORTAL_COUNT: 'gameplay.portalCount',
    GAMEPLAY_PLANAR_LEVEL_COUNT: 'gameplay.planarLevelCount',
    PRESET_ACTIVE_ID: 'preset.activeId',
    PRESET_ACTIVE_KIND: 'preset.activeKind',
    PRESET_LIST: 'preset.list',
    PRESET_STATUS: 'preset.status',
    MULTIPLAYER_STATUS: 'multiplayer.status',
    DEVELOPER_MODE_ENABLED: 'developer.modeEnabled',
    DEVELOPER_THEME_ID: 'developer.themeId',
    DEVELOPER_VISIBILITY_MODE: 'developer.visibilityMode',
    DEVELOPER_FIXED_PRESET_LOCK: 'developer.fixedPresetLock',
    DEVELOPER_ACTOR_ID: 'developer.actorId',
    DEVELOPER_RELEASE_PREVIEW: 'developer.releasePreview',
    DEVELOPER_TEXT_OVERRIDES: 'developer.textOverrides',
    MENU_TELEMETRY: 'menu.telemetry',
});

const SETTINGS_CHANGE_KEY_SET = new Set(Object.values(SETTINGS_CHANGE_KEYS));

export function isSettingsChangeKey(value) {
    return SETTINGS_CHANGE_KEY_SET.has(value);
}

export function normalizeSettingsChangeKeys(changedKeys) {
    if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
        return [];
    }

    const normalized = [];
    const seen = new Set();
    for (const key of changedKeys) {
        if (typeof key !== 'string') continue;
        const value = key.trim();
        if (!value || seen.has(value)) continue;
        if (!isSettingsChangeKey(value)) continue;
        seen.add(value);
        normalized.push(value);
    }
    return normalized;
}
