import { CONFIG } from '../core/Config.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';
import { SETTINGS_CHANGE_KEYS, normalizeSettingsChangeKeys } from './SettingsChangeKeys.js';
import { addChangedKeys, changedKeySetToArray } from './SettingsChangeSetOps.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export const MENU_CONTROLLER_EVENT_TYPES = Object.freeze({
    SETTINGS_CHANGED: 'settings_changed',
    START_MATCH: 'start_match',
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
        this.onEvent({ type, ...payload });
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
        const ui = this.ui;
        const settings = this.settings;
        const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;

        ui.modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                settings.mode = btn.dataset.mode === '2p' ? '2p' : '1p';
                this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.MODE]);
            });
        });

        if (Array.isArray(ui.gameModeButtons)) {
            ui.gameModeButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const requested = String(btn.dataset.gameMode || GAME_MODE_TYPES.CLASSIC);
                    const changedKeys = [SETTINGS_CHANGE_KEYS.GAME_MODE];
                    settings.gameMode = resolveActiveGameMode(requested, huntFeatureEnabled);
                    if (settings.gameMode !== GAME_MODE_TYPES.HUNT) {
                        if (!settings.hunt) settings.hunt = {};
                        settings.hunt.respawnEnabled = false;
                        changedKeys.push(SETTINGS_CHANGE_KEYS.HUNT_RESPAWN_ENABLED);
                    }
                    this._emitSettingsChangedImmediate(changedKeys);
                });
            });
        }

        if (ui.huntRespawnToggle) {
            ui.huntRespawnToggle.addEventListener('change', () => {
                if (!settings.hunt) settings.hunt = {};
                settings.hunt.respawnEnabled = !!ui.huntRespawnToggle.checked;
                this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.HUNT_RESPAWN_ENABLED]);
            });
        }

        if (ui.vehicleSelectP1) {
            ui.vehicleSelectP1.addEventListener('change', (e) => {
                settings.vehicles.PLAYER_1 = e.target.value;
                this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.VEHICLES_PLAYER_1]);
            });
        }
        if (ui.vehicleSelectP2) {
            ui.vehicleSelectP2.addEventListener('change', (e) => {
                settings.vehicles.PLAYER_2 = e.target.value;
                this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.VEHICLES_PLAYER_2]);
            });
        }

        ui.mapSelect.addEventListener('change', (e) => {
            const selectedMapKey = String(e.target.value || '');
            settings.mapKey = (selectedMapKey === CUSTOM_MAP_KEY || CONFIG.MAPS[selectedMapKey])
                ? selectedMapKey
                : 'standard';
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.MAP_KEY]);
        });

        ui.botSlider.addEventListener('input', () => {
            settings.numBots = clamp(parseInt(ui.botSlider.value, 10), 0, 8);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.BOTS_COUNT]);
        });

        if (ui.botDifficultySelect) {
            ui.botDifficultySelect.addEventListener('change', () => {
                const value = String(ui.botDifficultySelect.value || '').toUpperCase();
                settings.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(value) ? value : 'NORMAL';
                this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.BOTS_DIFFICULTY]);
            });
        }

        ui.winSlider.addEventListener('input', () => {
            settings.winsNeeded = clamp(parseInt(ui.winSlider.value, 10), 1, 15);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.RULES_WINS_NEEDED]);
        });

        ui.autoRollToggle.addEventListener('change', () => {
            settings.autoRoll = !!ui.autoRollToggle.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_AUTO_ROLL]);
        });

        ui.invertP1.addEventListener('change', () => {
            settings.invertPitch.PLAYER_1 = !!ui.invertP1.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_INVERT_P1]);
        });

        ui.invertP2.addEventListener('change', () => {
            settings.invertPitch.PLAYER_2 = !!ui.invertP2.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_INVERT_P2]);
        });

        ui.cockpitCamP1.addEventListener('change', () => {
            settings.cockpitCamera.PLAYER_1 = !!ui.cockpitCamP1.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_COCKPIT_P1]);
        });

        ui.cockpitCamP2.addEventListener('change', () => {
            settings.cockpitCamera.PLAYER_2 = !!ui.cockpitCamP2.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_COCKPIT_P2]);
        });

        const planarModeToggle = document.getElementById('planar-mode-toggle');
        if (planarModeToggle) {
            planarModeToggle.addEventListener('change', (e) => {
                if (!settings.gameplay) settings.gameplay = {};
                settings.gameplay.planarMode = e.target.checked;
                const changedKeys = [SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANAR_MODE];

                // Usability: Auto-active portals if they are off, because Planar Mode needs them
                if (settings.gameplay.planarMode && (settings.gameplay.portalCount || 0) === 0) {
                    settings.gameplay.portalCount = 4;
                    changedKeys.push(SETTINGS_CHANGE_KEYS.GAMEPLAY_PORTAL_COUNT);
                    this._emit(MENU_CONTROLLER_EVENT_TYPES.SHOW_STATUS_TOAST, {
                        message: 'Ebenen-Modus: 4 Portale aktiviert',
                    });
                }

                this._emitSettingsChangedImmediate(changedKeys);
            });
        }

        ui.portalsToggle.addEventListener('change', () => {
            settings.portalsEnabled = !!ui.portalsToggle.checked;
            this._emitSettingsChangedImmediate([SETTINGS_CHANGE_KEYS.RULES_PORTALS_ENABLED]);
        });

        ui.speedSlider.addEventListener('input', () => {
            settings.gameplay.speed = clamp(parseFloat(ui.speedSlider.value), 8, 40);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_SPEED]);
        });

        ui.turnSlider.addEventListener('input', () => {
            settings.gameplay.turnSensitivity = clamp(parseFloat(ui.turnSlider.value), 0.8, 5);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_TURN_SENSITIVITY]);
        });

        ui.planeSizeSlider.addEventListener('input', () => {
            settings.gameplay.planeScale = clamp(parseFloat(ui.planeSizeSlider.value), 0.6, 2.0);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANE_SCALE]);
        });

        ui.trailWidthSlider.addEventListener('input', () => {
            settings.gameplay.trailWidth = clamp(parseFloat(ui.trailWidthSlider.value), 0.2, 2.5);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_TRAIL_WIDTH]);
        });

        ui.gapSizeSlider.addEventListener('input', () => {
            settings.gameplay.gapSize = clamp(parseFloat(ui.gapSizeSlider.value), 0.05, 1.5);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_GAP_SIZE]);
        });

        ui.gapFrequencySlider.addEventListener('input', () => {
            settings.gameplay.gapFrequency = clamp(parseFloat(ui.gapFrequencySlider.value), 0, 0.25);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_GAP_FREQUENCY]);
        });

        ui.itemAmountSlider.addEventListener('input', () => {
            settings.gameplay.itemAmount = clamp(parseInt(ui.itemAmountSlider.value, 10), 1, 20);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_ITEM_AMOUNT]);
        });

        ui.fireRateSlider.addEventListener('input', () => {
            settings.gameplay.fireRate = clamp(parseFloat(ui.fireRateSlider.value), 0.1, 2.0);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_FIRE_RATE]);
        });

        ui.lockOnSlider.addEventListener('input', () => {
            settings.gameplay.lockOnAngle = clamp(parseInt(ui.lockOnSlider.value, 10), 5, 45);
            this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_LOCK_ON_ANGLE]);
        });

        if (ui.mgTrailAimSlider) {
            ui.mgTrailAimSlider.addEventListener('input', () => {
                settings.gameplay.mgTrailAimRadius = clamp(parseFloat(ui.mgTrailAimSlider.value), 0.2, 3.0);
                this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_MG_TRAIL_AIM_RADIUS]);
            });
        }

        ui.keybindP1.addEventListener('click', (e) => {
            const btn = e.target.closest('button.keybind-btn');
            if (!btn) return;
            this._emit(MENU_CONTROLLER_EVENT_TYPES.START_KEY_CAPTURE, {
                player: 'PLAYER_1',
                action: btn.dataset.action,
            });
        });

        ui.keybindP2.addEventListener('click', (e) => {
            const btn = e.target.closest('button.keybind-btn');
            if (!btn) return;
            this._emit(MENU_CONTROLLER_EVENT_TYPES.START_KEY_CAPTURE, {
                player: 'PLAYER_2',
                action: btn.dataset.action,
            });
        });

        ui.resetKeysButton.addEventListener('click', () => {
            this._emit(MENU_CONTROLLER_EVENT_TYPES.RESET_KEYS);
        });

        ui.saveKeysButton.addEventListener('click', () => {
            this._emit(MENU_CONTROLLER_EVENT_TYPES.SAVE_KEYS);
        });

        ui.startButton.addEventListener('click', () => {
            this._emit(MENU_CONTROLLER_EVENT_TYPES.START_MATCH);
        });

        if (ui.openEditorButton) {
            ui.openEditorButton.addEventListener('click', () => {
                window.open('editor/map-editor-3d.html', '_blank');
            });
        }

        if (ui.openVehicleEditorButton) {
            ui.openVehicleEditorButton.addEventListener('click', () => {
                window.open('prototypes/vehicle-lab/index.html', '_blank');
            });
        }

        if (ui.profileSaveButton) {
            ui.profileSaveButton.addEventListener('click', () => {
                this._emit(MENU_CONTROLLER_EVENT_TYPES.SAVE_PROFILE, {
                    name: ui.profileNameInput?.value || '',
                });
            });
        }
        if (ui.profileLoadButton) {
            ui.profileLoadButton.addEventListener('click', () => {
                this._emit(MENU_CONTROLLER_EVENT_TYPES.LOAD_PROFILE, {
                    name: ui.profileSelect?.value || '',
                });
            });
        }
        if (ui.profileDeleteButton) {
            ui.profileDeleteButton.addEventListener('click', () => {
                this._emit(MENU_CONTROLLER_EVENT_TYPES.DELETE_PROFILE, {
                    name: ui.profileSelect?.value || '',
                });
            });
        }

        const portalCountSlider = document.getElementById('portal-count-slider');
        const portalCountLabel = document.getElementById('portal-count-label');
        if (portalCountSlider && portalCountLabel) {
            portalCountSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                portalCountLabel.textContent = val;
                if (!settings.gameplay) settings.gameplay = {};
                settings.gameplay.portalCount = val;
                this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_PORTAL_COUNT]);
            });
        }

        const planarLevelCountSlider = document.getElementById('planar-level-count-slider');
        const planarLevelCountLabel = document.getElementById('planar-level-count-label');
        if (planarLevelCountSlider && planarLevelCountLabel) {
            planarLevelCountSlider.addEventListener('input', (e) => {
                const val = clamp(parseInt(e.target.value, 10), 2, 10);
                planarLevelCountLabel.textContent = val;
                if (!settings.gameplay) settings.gameplay = {};
                settings.gameplay.planarLevelCount = val;
                this._queueInputSettingsChanged([SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANAR_LEVEL_COUNT]);
            });
        }
    }
}
