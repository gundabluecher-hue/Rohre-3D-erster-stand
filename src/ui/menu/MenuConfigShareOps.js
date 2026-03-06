function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function sanitizeString(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
}

function createSharePayload(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    return {
        sessionType: sanitizeString(source?.localSettings?.sessionType, 'single'),
        modePath: sanitizeString(source?.localSettings?.modePath, 'normal'),
        themeMode: sanitizeString(source?.localSettings?.themeMode, 'dunkel'),
        mode: source.mode === '2p' ? '2p' : '1p',
        gameMode: sanitizeString(source.gameMode, 'CLASSIC'),
        mapKey: sanitizeString(source.mapKey, 'standard'),
        numBots: Number.isFinite(Number(source.numBots)) ? Number(source.numBots) : 1,
        botDifficulty: sanitizeString(source.botDifficulty, 'NORMAL').toUpperCase(),
        winsNeeded: Number.isFinite(Number(source.winsNeeded)) ? Number(source.winsNeeded) : 5,
        autoRoll: !!source.autoRoll,
        portalsEnabled: !!source.portalsEnabled,
        vehicles: deepClone(source.vehicles || {}),
        hunt: deepClone(source.hunt || {}),
        gameplay: deepClone(source.gameplay || {}),
    };
}

function applySharePayload(settings, payload) {
    if (!settings || typeof settings !== 'object' || !payload || typeof payload !== 'object') {
        return false;
    }

    settings.mode = payload.mode === '2p' ? '2p' : '1p';
    settings.gameMode = sanitizeString(payload.gameMode, settings.gameMode || 'CLASSIC');
    settings.mapKey = sanitizeString(payload.mapKey, settings.mapKey || 'standard');
    settings.numBots = Number.isFinite(Number(payload.numBots)) ? Number(payload.numBots) : settings.numBots;
    settings.botDifficulty = sanitizeString(payload.botDifficulty, settings.botDifficulty || 'NORMAL').toUpperCase();
    settings.winsNeeded = Number.isFinite(Number(payload.winsNeeded)) ? Number(payload.winsNeeded) : settings.winsNeeded;
    settings.autoRoll = !!payload.autoRoll;
    settings.portalsEnabled = !!payload.portalsEnabled;
    settings.vehicles = {
        ...(settings.vehicles && typeof settings.vehicles === 'object' ? settings.vehicles : {}),
        ...(payload.vehicles && typeof payload.vehicles === 'object' ? payload.vehicles : {}),
    };
    settings.hunt = {
        ...(settings.hunt && typeof settings.hunt === 'object' ? settings.hunt : {}),
        ...(payload.hunt && typeof payload.hunt === 'object' ? payload.hunt : {}),
    };
    settings.gameplay = {
        ...(settings.gameplay && typeof settings.gameplay === 'object' ? settings.gameplay : {}),
        ...(payload.gameplay && typeof payload.gameplay === 'object' ? payload.gameplay : {}),
    };
    if (!settings.localSettings || typeof settings.localSettings !== 'object') {
        settings.localSettings = {};
    }
    settings.localSettings.sessionType = sanitizeString(payload.sessionType, settings.localSettings.sessionType || 'single');
    settings.localSettings.modePath = sanitizeString(payload.modePath, settings.localSettings.modePath || 'normal');
    settings.localSettings.themeMode = sanitizeString(payload.themeMode, settings.localSettings.themeMode || 'dunkel');
    return true;
}

export function exportMenuConfigAsJson(settings) {
    return JSON.stringify(createSharePayload(settings), null, 2);
}

export function exportMenuConfigAsCode(settings) {
    const json = JSON.stringify(createSharePayload(settings));
    try {
        return btoa(unescape(encodeURIComponent(json)));
    } catch {
        return '';
    }
}

export function importMenuConfigFromInput(settings, inputValue) {
    const raw = sanitizeString(inputValue);
    if (!raw) return { success: false, reason: 'empty_input' };

    let payload = null;
    try {
        payload = JSON.parse(raw);
    } catch {
        try {
            const decoded = decodeURIComponent(escape(atob(raw)));
            payload = JSON.parse(decoded);
        } catch {
            payload = null;
        }
    }

    if (!payload || typeof payload !== 'object') {
        return { success: false, reason: 'invalid_payload' };
    }

    const applied = applySharePayload(settings, payload);
    return {
        success: applied,
        reason: applied ? 'imported' : 'apply_failed',
        payload,
    };
}

