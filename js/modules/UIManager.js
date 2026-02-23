// ============================================
// UIManager.js - Handles DOM interactions, settings syncing and UI state
// ============================================

import { CONFIG } from './Config.js';
import { VEHICLE_DEFINITIONS } from '../entities/vehicle-registry.js';
import { CUSTOM_MAP_KEY } from './MapSchema.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export class UIManager {
    constructor(game) {
        this.game = game;
        this.ui = game.ui;
        this.settings = game.settings;

        this._navButtons = game._navButtons || [];
        this._menuButtonByPanel = game._menuButtonByPanel || new Map();
        this._lastMenuTrigger = game._lastMenuTrigger || null;
        this._settingsControlsBound = false;
    }

    init() {
        this._setupVehicleSelects();
        this._setupMapSelect();
        this._setupMenuNavigation();
        this.syncAll();
        this.updateContext();
    }

    _setupVehicleSelects() {
        const populate = (select) => {
            if (!select) return;
            select.innerHTML = '';
            VEHICLE_DEFINITIONS.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = v.label;
                select.appendChild(opt);
            });
        };
        populate(this.ui.vehicleSelectP1);
        populate(this.ui.vehicleSelectP2);
    }

    _setupMapSelect() {
        const select = this.ui.mapSelect;
        if (!select) return;

        const currentValue = String(select.value || this.settings?.mapKey || 'standard');
        select.innerHTML = '';

        Object.entries(CONFIG.MAPS || {}).forEach(([key, mapDef]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = String(mapDef?.name || key);
            select.appendChild(opt);
        });

        if (CONFIG.MAPS?.[currentValue]) {
            select.value = currentValue;
        } else if (CONFIG.MAPS?.standard) {
            select.value = 'standard';
        }
    }

    _setupMenuNavigation() {
        this._navButtons = Array.from(document.querySelectorAll('.nav-btn'));
        const submenus = Array.from(document.querySelectorAll('.submenu-panel'));

        this._navButtons.forEach(btn => {
            const targetId = btn.dataset.submenu;
            if (targetId) this._menuButtonByPanel.set(targetId, btn);

            btn.addEventListener('click', () => {
                const targetPanel = document.getElementById(targetId);
                if (!targetPanel) return;

                submenus.forEach(p => p.classList.add('hidden'));
                this._navButtons.forEach(b => b.classList.remove('active'));

                targetPanel.classList.remove('hidden');
                btn.classList.add('active');

                this.game._activeSubmenu = targetId;
                this.updateContext();
            });
        });
    }

    showMainNav() {
        const submenus = Array.from(document.querySelectorAll('.submenu-panel'));
        submenus.forEach(p => p.classList.add('hidden'));
        this._navButtons.forEach(b => b.classList.remove('active'));
        this.game._activeSubmenu = null;
        this.updateContext();
    }

    bindSettingsControls() {
        if (this._settingsControlsBound) return;
        this._settingsControlsBound = true;

        const game = this.game;
        const ui = this.ui;

        ui.modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                game.settings.mode = btn.dataset.mode === '2p' ? '2p' : '1p';
                game._onSettingsChanged();
            });
        });

        if (ui.vehicleSelectP1) {
            ui.vehicleSelectP1.addEventListener('change', (event) => {
                game.settings.vehicles.PLAYER_1 = event.target.value;
                game._onSettingsChanged();
            });
        }
        if (ui.vehicleSelectP2) {
            ui.vehicleSelectP2.addEventListener('change', (event) => {
                game.settings.vehicles.PLAYER_2 = event.target.value;
                game._onSettingsChanged();
            });
        }

        if (ui.mapSelect) {
            ui.mapSelect.addEventListener('change', (event) => {
                const selectedMapKey = String(event.target.value || '');
                game.settings.mapKey = (selectedMapKey === CUSTOM_MAP_KEY || CONFIG.MAPS[selectedMapKey])
                    ? selectedMapKey
                    : 'standard';
                game._onSettingsChanged();
            });
        }

        if (ui.botSlider) {
            ui.botSlider.addEventListener('input', () => {
                game.settings.numBots = clamp(parseInt(ui.botSlider.value, 10), 0, 8);
                game._onSettingsChanged();
            });
        }

        if (ui.botDifficultySelect) {
            ui.botDifficultySelect.addEventListener('change', () => {
                const value = String(ui.botDifficultySelect.value || '').toUpperCase();
                game.settings.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(value) ? value : 'NORMAL';
                game._onSettingsChanged();
            });
        }

        if (ui.winSlider) {
            ui.winSlider.addEventListener('input', () => {
                game.settings.winsNeeded = clamp(parseInt(ui.winSlider.value, 10), 1, 15);
                game._onSettingsChanged();
            });
        }

        if (ui.autoRollToggle) {
            ui.autoRollToggle.addEventListener('change', () => {
                game.settings.autoRoll = !!ui.autoRollToggle.checked;
                game._onSettingsChanged();
            });
        }

        if (ui.invertP1) {
            ui.invertP1.addEventListener('change', () => {
                game.settings.invertPitch.PLAYER_1 = !!ui.invertP1.checked;
                game._onSettingsChanged();
            });
        }

        if (ui.invertP2) {
            ui.invertP2.addEventListener('change', () => {
                game.settings.invertPitch.PLAYER_2 = !!ui.invertP2.checked;
                game._onSettingsChanged();
            });
        }

        if (ui.cockpitCamP1) {
            ui.cockpitCamP1.addEventListener('change', () => {
                game.settings.cockpitCamera.PLAYER_1 = !!ui.cockpitCamP1.checked;
                game._onSettingsChanged();
            });
        }

        if (ui.cockpitCamP2) {
            ui.cockpitCamP2.addEventListener('change', () => {
                game.settings.cockpitCamera.PLAYER_2 = !!ui.cockpitCamP2.checked;
                game._onSettingsChanged();
            });
        }

        const planarModeToggle = document.getElementById('planar-mode-toggle');
        if (planarModeToggle) {
            planarModeToggle.addEventListener('change', (event) => {
                if (!game.settings.gameplay) game.settings.gameplay = {};
                game.settings.gameplay.planarMode = !!event.target.checked;

                if (game.settings.gameplay.planarMode && (game.settings.gameplay.portalCount || 0) === 0) {
                    game.settings.gameplay.portalCount = 4;
                    game._showStatusToast('Ebenen-Modus: 4 Portale aktiviert');
                }

                game._onSettingsChanged();
            });
        }

        if (ui.portalsToggle) {
            ui.portalsToggle.addEventListener('change', () => {
                game.settings.portalsEnabled = !!ui.portalsToggle.checked;
                game._onSettingsChanged();
            });
        }

        this._bindGameplaySlider(ui.speedSlider, (value) => {
            game.settings.gameplay.speed = clamp(parseFloat(value), 8, 40);
        });
        this._bindGameplaySlider(ui.turnSlider, (value) => {
            game.settings.gameplay.turnSensitivity = clamp(parseFloat(value), 0.8, 5);
        });
        this._bindGameplaySlider(ui.planeSizeSlider, (value) => {
            game.settings.gameplay.planeScale = clamp(parseFloat(value), 0.6, 2.0);
        });
        this._bindGameplaySlider(ui.trailWidthSlider, (value) => {
            game.settings.gameplay.trailWidth = clamp(parseFloat(value), 0.2, 2.5);
        });
        this._bindGameplaySlider(ui.gapSizeSlider, (value) => {
            game.settings.gameplay.gapSize = clamp(parseFloat(value), 0.05, 1.5);
        });
        this._bindGameplaySlider(ui.gapFrequencySlider, (value) => {
            game.settings.gameplay.gapFrequency = clamp(parseFloat(value), 0, 0.25);
        });
        this._bindGameplaySlider(ui.itemAmountSlider, (value) => {
            game.settings.gameplay.itemAmount = clamp(parseInt(value, 10), 1, 20);
        });
        this._bindGameplaySlider(ui.fireRateSlider, (value) => {
            game.settings.gameplay.fireRate = clamp(parseFloat(value), 0.1, 2.0);
        });
        this._bindGameplaySlider(ui.lockOnSlider, (value) => {
            game.settings.gameplay.lockOnAngle = clamp(parseInt(value, 10), 5, 45);
        });

        const portalCountSlider = document.getElementById('portal-count-slider');
        const portalCountLabel = document.getElementById('portal-count-label');
        if (portalCountSlider && portalCountLabel) {
            portalCountSlider.addEventListener('input', (event) => {
                const val = parseInt(event.target.value, 10);
                portalCountLabel.textContent = val;
                if (!game.settings.gameplay) game.settings.gameplay = {};
                game.settings.gameplay.portalCount = val;
                game._onSettingsChanged();
            });
        }

        const planarLevelCountSlider = document.getElementById('planar-level-count-slider');
        const planarLevelCountLabel = document.getElementById('planar-level-count-label');
        if (planarLevelCountSlider && planarLevelCountLabel) {
            planarLevelCountSlider.addEventListener('input', (event) => {
                const val = clamp(parseInt(event.target.value, 10), 2, 10);
                planarLevelCountLabel.textContent = val;
                if (!game.settings.gameplay) game.settings.gameplay = {};
                game.settings.gameplay.planarLevelCount = val;
                game._onSettingsChanged();
            });
        }
    }

    _bindGameplaySlider(slider, applyValue) {
        if (!slider || typeof applyValue !== 'function') return;
        slider.addEventListener('input', () => {
            applyValue(slider.value);
            this.game._onSettingsChanged();
        });
    }

    syncAll() {
        const settings = this.game.settings;
        const ui = this.ui;

        // Mode
        ui.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === settings.mode);
        });
        if (ui.vehicleP2Container) {
            ui.vehicleP2Container.classList.toggle('hidden', settings.mode !== '2p');
        }

        // Map
        ui.mapSelect.value = settings.mapKey;

        // Bots
        ui.botSlider.value = settings.numBots;
        ui.botLabel.textContent = settings.numBots;
        if (ui.botDifficultySelect) ui.botDifficultySelect.value = settings.botDifficulty;

        // Rules
        ui.winSlider.value = settings.winsNeeded;
        ui.winLabel.textContent = settings.winsNeeded;
        ui.autoRollToggle.checked = !!settings.autoRoll;
        ui.invertP1.checked = !!settings.invertPitch.PLAYER_1;
        ui.invertP2.checked = !!settings.invertPitch.PLAYER_2;
        ui.cockpitCamP1.checked = !!settings.cockpitCamera.PLAYER_1;
        ui.cockpitCamP2.checked = !!settings.cockpitCamera.PLAYER_2;
        ui.portalsToggle.checked = !!settings.portalsEnabled;

        const gp = settings.gameplay;
        ui.speedSlider.value = gp.speed;
        ui.speedLabel.textContent = `${gp.speed} m/s`;
        ui.turnSlider.value = gp.turnSensitivity;
        ui.turnLabel.textContent = gp.turnSensitivity.toFixed(1);
        ui.planeSizeSlider.value = gp.planeScale;
        ui.planeSizeLabel.textContent = gp.planeScale.toFixed(1);
        ui.trailWidthSlider.value = gp.trailWidth;
        ui.trailWidthLabel.textContent = gp.trailWidth.toFixed(1);
        ui.gapSizeSlider.value = gp.gapSize;
        ui.gapSizeLabel.textContent = gp.gapSize.toFixed(2);
        ui.gapFrequencySlider.value = gp.gapFrequency;
        ui.gapFrequencyLabel.textContent = (gp.gapFrequency * 100).toFixed(0) + '%';
        ui.itemAmountSlider.value = gp.itemAmount;
        ui.itemAmountLabel.textContent = gp.itemAmount;
        ui.fireRateSlider.value = gp.fireRate;
        ui.fireRateLabel.textContent = gp.fireRate.toFixed(2) + 's';
        ui.lockOnSlider.value = gp.lockOnAngle;
        ui.lockOnLabel.textContent = gp.lockOnAngle + '°';

        const planarToggle = document.getElementById('planar-mode-toggle');
        if (planarToggle) planarToggle.checked = !!gp.planarMode;

        // Vehicles
        if (ui.vehicleSelectP1) ui.vehicleSelectP1.value = settings.vehicles.PLAYER_1;
        if (ui.vehicleSelectP2) ui.vehicleSelectP2.value = settings.vehicles.PLAYER_2;
    }

    updateContext() {
        if (!this.ui.menuContext) return;
        const section = this._getMenuSectionLabel(this.game._activeSubmenu);
        const activeProfile = this.game.activeProfileName || 'Ungespeichert';
        this.ui.menuContext.textContent = `${section} · Profil: ${activeProfile}`;
    }

    _getMenuSectionLabel(panelId) {
        if (!panelId) return 'Hauptmenue';
        const linkedButton = this._menuButtonByPanel.get(panelId);
        if (linkedButton) return (linkedButton.textContent || '').trim();
        return 'Untermenue';
    }

    showToast(message, tone = 'info') {
        const toast = this.ui.statusToast;
        if (!toast) return;
        toast.textContent = message;
        toast.className = `status-toast toast-${tone} show`;
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
    }
}
