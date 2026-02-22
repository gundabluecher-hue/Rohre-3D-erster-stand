// ============================================
// ProfileDataOps.js - pure profile array operations
// ============================================

function ensureArray(profiles) {
    return Array.isArray(profiles) ? profiles : [];
}

function requireCallback(fn, name) {
    if (typeof fn !== 'function') {
        throw new TypeError(`${name} callback is required`);
    }
    return fn;
}

export function upsertProfileEntry(profiles, entry, options = {}) {
    const findProfileIndexByName = requireCallback(options.findProfileIndexByName, 'findProfileIndexByName');
    const nextProfiles = [...ensureArray(profiles)];
    const index = findProfileIndexByName(nextProfiles, entry?.name);

    if (index >= 0) {
        nextProfiles[index] = entry;
        return {
            profiles: nextProfiles,
            index,
            replaced: true,
            entry,
        };
    }

    nextProfiles.push(entry);
    return {
        profiles: nextProfiles,
        index: nextProfiles.length - 1,
        replaced: false,
        entry,
    };
}

export function removeProfileByName(profiles, profileName, options = {}) {
    const findProfileIndexByName = requireCallback(options.findProfileIndexByName, 'findProfileIndexByName');
    const sourceProfiles = ensureArray(profiles);
    const index = findProfileIndexByName(sourceProfiles, profileName);
    if (index < 0) {
        return {
            profiles: [...sourceProfiles],
            removedIndex: -1,
            removedProfile: null,
        };
    }

    return {
        profiles: sourceProfiles.filter((_, i) => i !== index),
        removedIndex: index,
        removedProfile: sourceProfiles[index] || null,
    };
}

export function resolveActiveProfileName(profiles, activeProfileName, options = {}) {
    const findProfileByName = requireCallback(options.findProfileByName, 'findProfileByName');
    const profile = findProfileByName(ensureArray(profiles), activeProfileName);
    return profile ? profile.name : '';
}
