import { MENU_SESSION_TYPES } from './MenuStateContracts.js';

const MENU_DRAFT_STORAGE_KEY = 'aero-arena-3d.menu-drafts.v1';
const MENU_DRAFT_STORAGE_SCHEMA_VERSION = 'menu-draft-store.v1';

const VALID_SESSION_TYPE_SET = new Set(Object.values(MENU_SESSION_TYPES));

function getDefaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

function normalizeString(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized || fallback;
}

export function normalizeSessionType(value, fallback = MENU_SESSION_TYPES.SINGLE) {
    const requested = normalizeString(value, fallback);
    return VALID_SESSION_TYPE_SET.has(requested) ? requested : fallback;
}

function cloneObject(value, fallback = {}) {
    if (!value || typeof value !== 'object') return { ...fallback };
    return JSON.parse(JSON.stringify(value));
}

function resolveModeFromSessionType(sessionType) {
    return normalizeSessionType(sessionType) === MENU_SESSION_TYPES.SPLITSCREEN ? '2p' : '1p';
}

function createSessionDraftSnapshot(settings, sessionType) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const localSettings = source.localSettings && typeof source.localSettings === 'object'
        ? source.localSettings
        : {};

    return {
        sessionType: normalizeSessionType(sessionType, localSettings.sessionType || MENU_SESSION_TYPES.SINGLE),
        mode: resolveModeFromSessionType(sessionType),
        modePath: normalizeString(localSettings.modePath, 'normal'),
        themeMode: normalizeString(localSettings.themeMode, 'dunkel'),
        mapKey: String(source.mapKey || 'standard'),
        gameMode: String(source.gameMode || 'CLASSIC'),
        numBots: Number.isFinite(Number(source.numBots)) ? Number(source.numBots) : 1,
        botDifficulty: String(source.botDifficulty || 'NORMAL').toUpperCase(),
        winsNeeded: Number.isFinite(Number(source.winsNeeded)) ? Number(source.winsNeeded) : 5,
        autoRoll: !!source.autoRoll,
        portalsEnabled: !!source.portalsEnabled,
        vehicles: cloneObject(source.vehicles, { PLAYER_1: 'ship5', PLAYER_2: 'ship5' }),
        hunt: {
            respawnEnabled: !!source?.hunt?.respawnEnabled,
        },
        gameplay: cloneObject(source.gameplay, {}),
    };
}

function applySnapshotToSettings(settings, snapshot) {
    if (!settings || typeof settings !== 'object' || !snapshot || typeof snapshot !== 'object') return false;

    settings.mode = snapshot.mode === '2p' ? '2p' : '1p';
    settings.mapKey = String(snapshot.mapKey || settings.mapKey || 'standard');
    settings.gameMode = String(snapshot.gameMode || settings.gameMode || 'CLASSIC');
    settings.numBots = Number.isFinite(Number(snapshot.numBots)) ? Number(snapshot.numBots) : settings.numBots;
    settings.botDifficulty = String(snapshot.botDifficulty || settings.botDifficulty || 'NORMAL').toUpperCase();
    settings.winsNeeded = Number.isFinite(Number(snapshot.winsNeeded)) ? Number(snapshot.winsNeeded) : settings.winsNeeded;
    settings.autoRoll = !!snapshot.autoRoll;
    settings.portalsEnabled = !!snapshot.portalsEnabled;

    if (!settings.vehicles || typeof settings.vehicles !== 'object') {
        settings.vehicles = { PLAYER_1: 'ship5', PLAYER_2: 'ship5' };
    }
    settings.vehicles.PLAYER_1 = String(snapshot?.vehicles?.PLAYER_1 || settings.vehicles.PLAYER_1 || 'ship5');
    settings.vehicles.PLAYER_2 = String(snapshot?.vehicles?.PLAYER_2 || settings.vehicles.PLAYER_2 || 'ship5');

    if (!settings.hunt || typeof settings.hunt !== 'object') {
        settings.hunt = { respawnEnabled: false };
    }
    settings.hunt.respawnEnabled = !!snapshot?.hunt?.respawnEnabled;

    settings.gameplay = {
        ...(settings.gameplay && typeof settings.gameplay === 'object' ? settings.gameplay : {}),
        ...cloneObject(snapshot.gameplay, {}),
    };

    if (!settings.localSettings || typeof settings.localSettings !== 'object') {
        settings.localSettings = {};
    }
    settings.localSettings.sessionType = normalizeSessionType(snapshot.sessionType, settings.localSettings.sessionType);
    settings.localSettings.modePath = normalizeString(snapshot.modePath, settings.localSettings.modePath || 'normal');
    settings.localSettings.themeMode = normalizeString(snapshot.themeMode, settings.localSettings.themeMode || 'dunkel');
    return true;
}

export class MenuDraftStore {
    constructor(options = {}) {
        this.storage = options.storage ?? getDefaultStorage();
        this.storageKey = options.storageKey || MENU_DRAFT_STORAGE_KEY;
    }

    _loadStore() {
        if (!this.storage || typeof this.storage.getItem !== 'function') {
            return { schemaVersion: MENU_DRAFT_STORAGE_SCHEMA_VERSION, drafts: {} };
        }

        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return { schemaVersion: MENU_DRAFT_STORAGE_SCHEMA_VERSION, drafts: {} };
            const parsed = JSON.parse(raw);
            return {
                schemaVersion: MENU_DRAFT_STORAGE_SCHEMA_VERSION,
                drafts: parsed?.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
            };
        } catch {
            return { schemaVersion: MENU_DRAFT_STORAGE_SCHEMA_VERSION, drafts: {} };
        }
    }

    _saveStore(store) {
        if (!this.storage || typeof this.storage.setItem !== 'function') return false;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(store));
            return true;
        } catch {
            return false;
        }
    }

    saveDraft(sessionType, settings) {
        const normalizedSessionType = normalizeSessionType(sessionType);
        const store = this._loadStore();
        store.drafts[normalizedSessionType] = createSessionDraftSnapshot(settings, normalizedSessionType);
        const stored = this._saveStore(store);
        return {
            success: stored,
            sessionType: normalizedSessionType,
            draft: stored ? cloneObject(store.drafts[normalizedSessionType], null) : null,
        };
    }

    loadDraft(sessionType) {
        const normalizedSessionType = normalizeSessionType(sessionType);
        const store = this._loadStore();
        const draft = store.drafts[normalizedSessionType];
        return draft && typeof draft === 'object' ? cloneObject(draft, null) : null;
    }

    applyDraft(settings, sessionType) {
        const draft = this.loadDraft(sessionType);
        if (!draft) return { success: false, reason: 'draft_not_found' };
        const applied = applySnapshotToSettings(settings, draft);
        return {
            success: applied,
            reason: applied ? 'applied' : 'apply_failed',
            draft,
        };
    }

    clearDraft(sessionType) {
        const normalizedSessionType = normalizeSessionType(sessionType);
        const store = this._loadStore();
        if (!Object.prototype.hasOwnProperty.call(store.drafts, normalizedSessionType)) {
            return { success: false, reason: 'draft_not_found' };
        }
        delete store.drafts[normalizedSessionType];
        const stored = this._saveStore(store);
        return { success: stored, reason: stored ? 'cleared' : 'storage_failed' };
    }
}
