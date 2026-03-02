import { CONFIG } from '../core/Config.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';

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
    }

    _emit(type, payload = {}) {
        if (!this.onEvent) return;
        this.onEvent({ type, ...payload });
    }

    _emitSettingsChanged() {
        this._emit(MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED);
    }

    setupListeners() {
        const ui = this.ui;
        const settings = this.settings;
        const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;

        ui.modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                settings.mode = btn.dataset.mode === '2p' ? '2p' : '1p';
                this._emitSettingsChanged();
            });
        });

        if (Array.isArray(ui.gameModeButtons)) {
            ui.gameModeButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const requested = String(btn.dataset.gameMode || GAME_MODE_TYPES.CLASSIC);
                    settings.gameMode = resolveActiveGameMode(requested, huntFeatureEnabled);
                    if (settings.gameMode !== GAME_MODE_TYPES.HUNT) {
                        if (!settings.hunt) settings.hunt = {};
                        settings.hunt.respawnEnabled = false;
                    }
                    this._emitSettingsChanged();
                });
            });
        }

        if (ui.huntRespawnToggle) {
            ui.huntRespawnToggle.addEventListener('change', () => {
                if (!settings.hunt) settings.hunt = {};
                settings.hunt.respawnEnabled = !!ui.huntRespawnToggle.checked;
                this._emitSettingsChanged();
            });
        }

        if (ui.vehicleSelectP1) {
            ui.vehicleSelectP1.addEventListener('change', (e) => {
                settings.vehicles.PLAYER_1 = e.target.value;
                this._emitSettingsChanged();
            });
        }
        if (ui.vehicleSelectP2) {
            ui.vehicleSelectP2.addEventListener('change', (e) => {
                settings.vehicles.PLAYER_2 = e.target.value;
                this._emitSettingsChanged();
            });
        }

        ui.mapSelect.addEventListener('change', (e) => {
            const selectedMapKey = String(e.target.value || '');
            settings.mapKey = (selectedMapKey === CUSTOM_MAP_KEY || CONFIG.MAPS[selectedMapKey])
                ? selectedMapKey
                : 'standard';
            this._emitSettingsChanged();
        });

        ui.botSlider.addEventListener('input', () => {
            settings.numBots = clamp(parseInt(ui.botSlider.value, 10), 0, 8);
            this._emitSettingsChanged();
        });

        if (ui.botDifficultySelect) {
            ui.botDifficultySelect.addEventListener('change', () => {
                const value = String(ui.botDifficultySelect.value || '').toUpperCase();
                settings.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(value) ? value : 'NORMAL';
                this._emitSettingsChanged();
            });
        }

        ui.winSlider.addEventListener('input', () => {
            settings.winsNeeded = clamp(parseInt(ui.winSlider.value, 10), 1, 15);
            this._emitSettingsChanged();
        });

        ui.autoRollToggle.addEventListener('change', () => {
            settings.autoRoll = !!ui.autoRollToggle.checked;
            this._emitSettingsChanged();
        });

        ui.invertP1.addEventListener('change', () => {
            settings.invertPitch.PLAYER_1 = !!ui.invertP1.checked;
            this._emitSettingsChanged();
        });

        ui.invertP2.addEventListener('change', () => {
            settings.invertPitch.PLAYER_2 = !!ui.invertP2.checked;
            this._emitSettingsChanged();
        });

        ui.cockpitCamP1.addEventListener('change', () => {
            settings.cockpitCamera.PLAYER_1 = !!ui.cockpitCamP1.checked;
            this._emitSettingsChanged();
        });

        ui.cockpitCamP2.addEventListener('change', () => {
            settings.cockpitCamera.PLAYER_2 = !!ui.cockpitCamP2.checked;
            this._emitSettingsChanged();
        });

        const planarModeToggle = document.getElementById('planar-mode-toggle');
        if (planarModeToggle) {
            planarModeToggle.addEventListener('change', (e) => {
                if (!settings.gameplay) settings.gameplay = {};
                settings.gameplay.planarMode = e.target.checked;

                // Usability: Auto-active portals if they are off, because Planar Mode needs them
                if (settings.gameplay.planarMode && (settings.gameplay.portalCount || 0) === 0) {
                    settings.gameplay.portalCount = 4;
                    this._emit(MENU_CONTROLLER_EVENT_TYPES.SHOW_STATUS_TOAST, {
                        message: 'Ebenen-Modus: 4 Portale aktiviert',
                    });
                }

                this._emitSettingsChanged();
            });
        }

        ui.portalsToggle.addEventListener('change', () => {
            settings.portalsEnabled = !!ui.portalsToggle.checked;
            this._emitSettingsChanged();
        });

        ui.speedSlider.addEventListener('input', () => {
            settings.gameplay.speed = clamp(parseFloat(ui.speedSlider.value), 8, 40);
            this._emitSettingsChanged();
        });

        ui.turnSlider.addEventListener('input', () => {
            settings.gameplay.turnSensitivity = clamp(parseFloat(ui.turnSlider.value), 0.8, 5);
            this._emitSettingsChanged();
        });

        ui.planeSizeSlider.addEventListener('input', () => {
            settings.gameplay.planeScale = clamp(parseFloat(ui.planeSizeSlider.value), 0.6, 2.0);
            this._emitSettingsChanged();
        });

        ui.trailWidthSlider.addEventListener('input', () => {
            settings.gameplay.trailWidth = clamp(parseFloat(ui.trailWidthSlider.value), 0.2, 2.5);
            this._emitSettingsChanged();
        });

        ui.gapSizeSlider.addEventListener('input', () => {
            settings.gameplay.gapSize = clamp(parseFloat(ui.gapSizeSlider.value), 0.05, 1.5);
            this._emitSettingsChanged();
        });

        ui.gapFrequencySlider.addEventListener('input', () => {
            settings.gameplay.gapFrequency = clamp(parseFloat(ui.gapFrequencySlider.value), 0, 0.25);
            this._emitSettingsChanged();
        });

        ui.itemAmountSlider.addEventListener('input', () => {
            settings.gameplay.itemAmount = clamp(parseInt(ui.itemAmountSlider.value, 10), 1, 20);
            this._emitSettingsChanged();
        });

        ui.fireRateSlider.addEventListener('input', () => {
            settings.gameplay.fireRate = clamp(parseFloat(ui.fireRateSlider.value), 0.1, 2.0);
            this._emitSettingsChanged();
        });

        ui.lockOnSlider.addEventListener('input', () => {
            settings.gameplay.lockOnAngle = clamp(parseInt(ui.lockOnSlider.value, 10), 5, 45);
            this._emitSettingsChanged();
        });

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
                this._emitSettingsChanged();
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
                this._emitSettingsChanged();
            });
        }
    }
}
