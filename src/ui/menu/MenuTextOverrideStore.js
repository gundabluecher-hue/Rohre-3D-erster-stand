const MENU_TEXT_OVERRIDE_STORAGE_KEY = 'aero-arena-3d.menu-text-overrides.v1';

function getDefaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

function sanitizeTextId(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized;
}

function sanitizeTextValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export class MenuTextOverrideStore {
    constructor(options = {}) {
        this.storage = options.storage ?? getDefaultStorage();
        this.storageKey = options.storageKey || MENU_TEXT_OVERRIDE_STORAGE_KEY;
    }

    _loadRaw() {
        if (!this.storage || typeof this.storage.getItem !== 'function') return {};
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    _saveRaw(rawOverrides) {
        if (!this.storage || typeof this.storage.setItem !== 'function') return false;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(rawOverrides));
            return true;
        } catch {
            return false;
        }
    }

    listOverrides() {
        return this._loadRaw();
    }

    getOverride(textId) {
        const normalizedTextId = sanitizeTextId(textId);
        if (!normalizedTextId) return '';
        const overrides = this._loadRaw();
        return sanitizeTextValue(overrides[normalizedTextId]);
    }

    setOverride(textId, textValue) {
        const normalizedTextId = sanitizeTextId(textId);
        const normalizedTextValue = sanitizeTextValue(textValue);
        if (!normalizedTextId) return { success: false, reason: 'invalid_text_id' };

        const overrides = this._loadRaw();
        if (!normalizedTextValue) {
            delete overrides[normalizedTextId];
        } else {
            overrides[normalizedTextId] = normalizedTextValue;
        }

        const stored = this._saveRaw(overrides);
        return {
            success: stored,
            reason: stored ? 'updated' : 'storage_failed',
            textId: normalizedTextId,
            value: normalizedTextValue,
        };
    }

    clearOverride(textId) {
        return this.setOverride(textId, '');
    }
}

