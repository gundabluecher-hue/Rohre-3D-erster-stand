// ============================================
// ProfileManager.js - business logic for settings profiles
// ============================================

import { removeProfileByName, resolveActiveProfileName, upsertProfileEntry } from '../ui/ProfileDataOps.js';

export class ProfileManager {
    constructor(settingsStore) {
        this.store = settingsStore;
        this.profiles = this.store.loadProfiles();
        this.activeProfileName = '';
    }

    getProfiles() {
        return this.profiles;
    }

    getActiveProfileName() {
        return this.activeProfileName;
    }

    setActiveProfileName(name) {
        this.activeProfileName = name;
    }

    normalizeProfileName(rawName) {
        return this.store.normalizeProfileName(rawName);
    }

    findProfileByName(name) {
        return this.store.findProfileByName(this.profiles, name);
    }

    findProfileIndexByName(name) {
        return this.store.findProfileIndexByName(this.profiles, name);
    }

    resolveActiveProfileName(profileName) {
        return resolveActiveProfileName(this.profiles, profileName, this.getProfileDataOps());
    }

    getProfileDataOps() {
        return {
            findProfileIndexByName: (profiles, name) => this.store.findProfileIndexByName(profiles, name),
            findProfileByName: (profiles, name) => this.store.findProfileByName(profiles, name),
        };
    }

    getProfileUiStateOps() {
        return {
            normalizeProfileName: (rawName) => this.normalizeProfileName(rawName),
            ...this.getProfileDataOps(),
        };
    }

    getProfileControlStateOps() {
        return {
            normalizeProfileName: (rawName) => this.normalizeProfileName(rawName),
            resolveActiveProfileName: (profiles, profileName) => resolveActiveProfileName(profiles, profileName, this.getProfileDataOps()),
        };
    }

    saveProfile(profileName, currentSettings, currentActiveProfileName) {
        const name = this.normalizeProfileName(profileName);
        if (!name || name.length < 2) {
            return { success: false, error: 'Name zu kurz oder ungueltig (min. 2 Zeichen)' };
        }

        const idx = this.findProfileIndexByName(name);
        const effectiveActiveProfileName = this.resolveActiveProfileName(currentActiveProfileName);
        const activeIdx = this.findProfileIndexByName(effectiveActiveProfileName);
        const canOverwrite = idx >= 0 && idx === activeIdx;

        if (idx >= 0 && !canOverwrite) {
            return { success: false, error: 'Name existiert bereits' };
        }

        const isUpdate = idx >= 0;
        const entry = {
            name,
            updatedAt: Date.now(),
            settings: JSON.parse(JSON.stringify(currentSettings)),
        };

        this.profiles = upsertProfileEntry(this.profiles, entry, this.getProfileDataOps()).profiles;
        this.activeProfileName = name;

        const persisted = this.store.saveProfiles(this.profiles);
        if (!persisted) {
            return { success: false, error: 'Profil konnte nicht gespeichert werden (Speicher voll?)' };
        }

        return { success: true, isUpdate, name };
    }

    loadProfile(profileName) {
        const name = this.normalizeProfileName(profileName);
        const profile = this.findProfileByName(name);
        if (!profile) {
            return { success: false, error: 'Profil nicht gefunden' };
        }

        this.activeProfileName = profile.name;
        // Sanitize through store
        const sanitizedSettings = this.store.sanitizeSettings(profile.settings);

        return { success: true, profile: { ...profile, settings: sanitizedSettings } };
    }

    deleteProfile(profileName) {
        const name = this.normalizeProfileName(profileName);
        const index = this.findProfileIndexByName(name);
        if (index < 0) {
            return { success: false, error: 'Profil nicht gefunden' };
        }

        const removeResult = removeProfileByName(this.profiles, name, this.getProfileDataOps());
        const removedName = removeResult.removedProfile?.name || this.profiles[index].name;
        this.profiles = removeResult.profiles;
        this.activeProfileName = resolveActiveProfileName(this.profiles, this.activeProfileName, this.getProfileDataOps());

        const persisted = this.store.saveProfiles(this.profiles);
        if (!persisted) {
            return { success: false, error: 'Profil konnte nicht geloescht werden' };
        }

        return { success: true, removedName };
    }
}
