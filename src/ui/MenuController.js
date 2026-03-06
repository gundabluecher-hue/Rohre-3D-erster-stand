import { SETTINGS_CHANGE_KEYS, normalizeSettingsChangeKeys } from './SettingsChangeKeys.js';
import { addChangedKeys, changedKeySetToArray } from './SettingsChangeSetOps.js';
import { setupMenuGameplayBindings } from './menu/MenuGameplayBindings.js';
import { setupMenuProfileBindings } from './menu/MenuProfileBindings.js';
import { setupMenuControlBindings } from './menu/MenuControlBindings.js';
import { setupMenuDevPanelBindings } from './menu/MenuDevPanelBindings.js';

export const MENU_CONTROLLER_EVENT_CONTRACT_VERSION = 'menu-controller.v1';

export const MENU_CONTROLLER_EVENT_TYPES = Object.freeze({
    SETTINGS_CHANGED: 'settings_changed',
    SESSION_TYPE_CHANGE: 'session_type_change',
    MODE_PATH_CHANGE: 'mode_path_change',
    QUICKSTART_LAST_START: 'quickstart_last_start',
    QUICKSTART_RANDOM_START: 'quickstart_random_start',
    LEVEL3_RESET: 'level3_reset',
    LEVEL4_OPEN: 'level4_open',
    LEVEL4_CLOSE: 'level4_close',
    LEVEL4_RESET: 'level4_reset',
    CONFIG_EXPORT_CODE: 'config_export_code',
    CONFIG_EXPORT_JSON: 'config_export_json',
    CONFIG_IMPORT: 'config_import',
    START_MATCH: 'start_match',
    PRESET_APPLY: 'preset_apply',
    PRESET_SAVE_OPEN: 'preset_save_open',
    PRESET_SAVE_FIXED: 'preset_save_fixed',
    PRESET_DELETE: 'preset_delete',
    MULTIPLAYER_HOST: 'multiplayer_host',
    MULTIPLAYER_JOIN: 'multiplayer_join',
    MULTIPLAYER_READY_TOGGLE: 'multiplayer_ready_toggle',
    DEVELOPER_MODE_TOGGLE: 'developer_mode_toggle',
    DEVELOPER_THEME_CHANGE: 'developer_theme_change',
    DEVELOPER_VISIBILITY_CHANGE: 'developer_visibility_change',
    DEVELOPER_FIXED_PRESET_LOCK_TOGGLE: 'developer_fixed_preset_lock_toggle',
    DEVELOPER_ACTOR_CHANGE: 'developer_actor_change',
    DEVELOPER_RELEASE_PREVIEW_TOGGLE: 'developer_release_preview_toggle',
    DEVELOPER_TEXT_OVERRIDE_SET: 'developer_text_override_set',
    DEVELOPER_TEXT_OVERRIDE_CLEAR: 'developer_text_override_clear',
    START_KEY_CAPTURE: 'start_key_capture',
    SAVE_PROFILE: 'save_profile',
    LOAD_PROFILE: 'load_profile',
    DELETE_PROFILE: 'delete_profile',
    RESET_KEYS: 'reset_keys',
    SAVE_KEYS: 'save_keys',
    SHOW_STATUS_TOAST: 'show_status_toast',
});

export class MenuController {
    /**
     * @param {Object} options
     * @param {Object} options.ui Elements from the DOM
     * @param {Object} options.settings Current runtime settings
     * @param {Function} options.onEvent Event sink for emitted menu events
     */
    constructor(options) {
        this.ui = options.ui;
        this.settings = options.settings;
        this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
        this._queuedInputChangeKeys = new Set();
        this._queuedInputFlushHandle = null;
        this._queuedInputFlushUsesAnimationFrame = false;
    }

    _emit(type, payload = {}) {
        if (type !== MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED) {
            this._flushQueuedInputSettingsChangedNow();
        }
        if (!this.onEvent) return;
        this.onEvent({ contractVersion: MENU_CONTROLLER_EVENT_CONTRACT_VERSION, type, ...payload });
    }

    _emitSettingsChanged(changedKeys) {
        const normalizedChangedKeys = normalizeSettingsChangeKeys(changedKeys);
        if (normalizedChangedKeys.length > 0) {
            this._emit(MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED, { changedKeys: normalizedChangedKeys });
            return;
        }
        this._emit(MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED);
    }

    _emitSettingsChangedImmediate(changedKeys) {
        this._flushQueuedInputSettingsChangedNow();
        this._emitSettingsChanged(changedKeys);
    }

    _queueInputSettingsChanged(changedKeys) {
        const normalizedChangedKeys = normalizeSettingsChangeKeys(changedKeys);
        if (normalizedChangedKeys.length === 0) return;

        // Keep first input response immediate; merge only follow-up input bursts in the same frame.
        if (this._queuedInputFlushHandle === null) {
            this._emitSettingsChanged(normalizedChangedKeys);
            this._scheduleQueuedInputSettingsChangedFlush();
            return;
        }

        addChangedKeys(this._queuedInputChangeKeys, normalizedChangedKeys);
    }

    _scheduleQueuedInputSettingsChangedFlush() {
        if (this._queuedInputFlushHandle !== null) return;

        const flush = () => {
            this._queuedInputFlushHandle = null;
            this._queuedInputFlushUsesAnimationFrame = false;
            this._flushQueuedInputSettingsChanged();
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            this._queuedInputFlushUsesAnimationFrame = true;
            this._queuedInputFlushHandle = window.requestAnimationFrame(flush);
            return;
        }

        this._queuedInputFlushHandle = setTimeout(flush, 0);
    }

    _flushQueuedInputSettingsChangedNow() {
        if (this._queuedInputFlushHandle !== null) {
            this._cancelQueuedInputSettingsChangedFlush();
            this._queuedInputFlushHandle = null;
            this._queuedInputFlushUsesAnimationFrame = false;
        }
        this._flushQueuedInputSettingsChanged();
    }

    _flushQueuedInputSettingsChanged() {
        const changedKeys = changedKeySetToArray(this._queuedInputChangeKeys);
        if (changedKeys.length === 0) return;
        this._queuedInputChangeKeys.clear();
        this._emitSettingsChanged(changedKeys);
    }

    _cancelQueuedInputSettingsChangedFlush() {
        if (this._queuedInputFlushHandle === null) return;
        if (this._queuedInputFlushUsesAnimationFrame && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(this._queuedInputFlushHandle);
            return;
        }
        clearTimeout(this._queuedInputFlushHandle);
    }

    setupListeners() {
        const bindingContext = {
            ui: this.ui,
            settings: this.settings,
            eventTypes: MENU_CONTROLLER_EVENT_TYPES,
            settingsChangeKeys: SETTINGS_CHANGE_KEYS,
            emit: (type, payload) => this._emit(type, payload),
            emitSettingsChangedImmediate: (changedKeys) => this._emitSettingsChangedImmediate(changedKeys),
            queueInputSettingsChanged: (changedKeys) => this._queueInputSettingsChanged(changedKeys),
        };

        setupMenuGameplayBindings(bindingContext);
        setupMenuProfileBindings(bindingContext);
        setupMenuControlBindings(bindingContext);
        setupMenuDevPanelBindings(bindingContext);
    }
}
