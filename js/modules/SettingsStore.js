// ============================================
// SettingsStore.js - localStorage persistence for settings and profiles
// ============================================

const SETTINGS_STORAGE_KEY = 'aero-arena-3d.settings.v1';
const SETTINGS_STORAGE_LEGACY_KEYS = ['mini-curve-fever-3d.settings.v4', 'mini-curve-fever-3d.settings.v3'];
const SETTINGS_PROFILES_STORAGE_KEY = 'aero-arena-3d.settings-profiles.v1';

function getDefaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        // Some browser contexts can throw on localStorage access.
        return null;
    }
}

export class SettingsStore {
    constructor(options = {}) {
        this.storage = options.storage ?? getDefaultStorage();
        this.sanitizeSettings = typeof options.sanitizeSettings === 'function'
            ? options.sanitizeSettings
            : (settings) => settings;
        this.createDefaultSettings = typeof options.createDefaultSettings === 'function'
            ? options.createDefaultSettings
            : () => ({});
        this.settingsStorageKey = options.settingsStorageKey || SETTINGS_STORAGE_KEY;
        this.settingsStorageLegacyKeys = Array.isArray(options.settingsStorageLegacyKeys)
            ? [...options.settingsStorageLegacyKeys]
            : [...SETTINGS_STORAGE_LEGACY_KEYS];
        this.settingsProfilesStorageKey = options.settingsProfilesStorageKey || SETTINGS_PROFILES_STORAGE_KEY;
    }

    loadSettings() {
        if (!this.storage || typeof this.storage.getItem !== 'function') {
            return this.createDefaultSettings();
        }

        try {
            const keys = [this.settingsStorageKey, ...this.settingsStorageLegacyKeys];
            for (const key of keys) {
                const raw = this.storage.getItem(key);
                if (!raw) continue;
                const saved = JSON.parse(raw);
                return this.sanitizeSettings(saved);
            }
        } catch {
            // Ignore malformed storage and fall back to defaults.
        }
        return this.createDefaultSettings();
    }

    saveSettings(settings) {
        if (!this.storage || typeof this.storage.setItem !== 'function') {
            return false;
        }

        try {
            this.storage.setItem(this.settingsStorageKey, JSON.stringify(settings));
            return true;
        } catch {
            // Ignore persistence errors (private mode, quotas, etc.)
            return false;
        }
    }

    loadProfiles() {
        if (!this.storage || typeof this.storage.getItem !== 'function') {
            return [];
        }

        try {
            const raw = this.storage.getItem(this.settingsProfilesStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            const out = [];
            const used = new Set();
            for (const entry of parsed) {
                const name = this.normalizeProfileName(entry?.name || '');
                const key = this.getProfileNameKey(name);
                if (!name || used.has(key)) continue;
                used.add(key);
                out.push({
                    name,
                    updatedAt: Number(entry?.updatedAt || Date.now()),
                    settings: this.sanitizeSettings(entry?.settings || {}),
                });
            }
            out.sort((a, b) => b.updatedAt - a.updatedAt);
            return out;
        } catch {
            return [];
        }
    }

    saveProfiles(profiles) {
        if (!this.storage || typeof this.storage.setItem !== 'function') {
            return false;
        }

        try {
            this.storage.setItem(this.settingsProfilesStorageKey, JSON.stringify(profiles));
            return true;
        } catch {
            // Ignore persistence errors.
            return false;
        }
    }

    normalizeProfileName(rawName) {
        return String(rawName || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 32);
    }

    getProfileNameKey(rawName) {
        return this.normalizeProfileName(rawName).toLocaleLowerCase();
    }

    findProfileIndexByName(profiles, profileName) {
        const key = this.getProfileNameKey(profileName);
        if (!key) return -1;
        if (!Array.isArray(profiles)) return -1;
        return profiles.findIndex((profile) => this.getProfileNameKey(profile.name) === key);
    }

    findProfileByName(profiles, profileName) {
        const index = this.findProfileIndexByName(profiles, profileName);
        return index >= 0 ? profiles[index] : null;
    }
}
