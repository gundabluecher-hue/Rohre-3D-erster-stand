// ============================================
// UIManager.js - Handles DOM interactions, settings syncing and UI state
// ============================================

import { CONFIG } from '../core/Config.js';
import { VEHICLE_DEFINITIONS } from '../entities/vehicle-registry.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../hunt/HuntMode.js';
import { isSettingsChangeKey, normalizeSettingsChangeKeys } from './SettingsChangeKeys.js';
import { resolveSyncMethodNamesForChangeKeys } from './UISettingsSyncMap.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.ui = game.ui;
        this.settings = game.settings;

        this._navButtons = game._navButtons || [];
        this._menuButtonByPanel = game._menuButtonByPanel || new Map();
        this._lastMenuTrigger = game._lastMenuTrigger || null;
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

        const backButtons = Array.from(document.querySelectorAll('[data-back]'));
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.showMainNav();
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

    syncAll() {
        const settings = this.game.settings;
        this.syncModes(settings);
        this.syncMap(settings);
        this.syncBots(settings);
        this.syncRules(settings);
        this.syncGameplay(settings);
        this.syncVehicles(settings);
    }

    syncByChangeKeys(changedKeys) {
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
            this.syncAll();
            return;
        }

        for (const rawKey of changedKeys) {
            const key = typeof rawKey === 'string' ? rawKey.trim() : '';
            if (!key || !isSettingsChangeKey(key)) {
                this.syncAll();
                return;
            }
        }

        const normalizedKeys = normalizeSettingsChangeKeys(changedKeys);
        if (normalizedKeys.length === 0) {
            this.syncAll();
            return;
        }

        const syncMethodNames = resolveSyncMethodNamesForChangeKeys(normalizedKeys);
        if (syncMethodNames.length === 0) {
            this.syncAll();
            return;
        }

        for (const methodName of syncMethodNames) {
            const syncMethod = this[methodName];
            if (typeof syncMethod !== 'function') {
                this.syncAll();
                return;
            }
            syncMethod.call(this);
        }
    }

    syncModes(settings = this.game.settings) {
        const ui = this.ui;
        ui.modeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === settings.mode);
        });
        if (ui.vehicleP2Container) {
            ui.vehicleP2Container.classList.toggle('hidden', settings.mode !== '2p');
        }

        const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;
        const resolvedGameMode = resolveActiveGameMode(settings.gameMode, huntFeatureEnabled);
        settings.gameMode = resolvedGameMode;
        if (!settings.hunt) settings.hunt = { respawnEnabled: false };
        if (resolvedGameMode !== GAME_MODE_TYPES.HUNT) {
            settings.hunt.respawnEnabled = false;
        }

        if (Array.isArray(ui.gameModeButtons)) {
            ui.gameModeButtons.forEach((btn) => {
                const buttonMode = resolveActiveGameMode(btn.dataset.gameMode, huntFeatureEnabled);
                const isHuntButton = buttonMode === GAME_MODE_TYPES.HUNT;
                btn.classList.toggle('active', buttonMode === resolvedGameMode);
                btn.disabled = isHuntButton && !huntFeatureEnabled;
                btn.title = btn.disabled ? 'Hunt-Modus ist per Feature-Flag deaktiviert' : '';
            });
        }
        if (ui.huntModeHint) {
            ui.huntModeHint.textContent = huntFeatureEnabled
                ? 'Regelset fuer die laufende Session waehlen.'
                : 'Hunt-Modus ist per Feature-Flag deaktiviert.';
        }
        if (ui.huntRespawnRow) {
            ui.huntRespawnRow.classList.toggle('hidden', resolvedGameMode !== GAME_MODE_TYPES.HUNT);
        }
        if (ui.huntRespawnToggle) {
            ui.huntRespawnToggle.checked = !!settings?.hunt?.respawnEnabled;
            ui.huntRespawnToggle.disabled = resolvedGameMode !== GAME_MODE_TYPES.HUNT;
        }
    }

    syncMap(settings = this.game.settings) {
        this.ui.mapSelect.value = settings.mapKey;
    }

    syncBots(settings = this.game.settings) {
        const ui = this.ui;
        ui.botSlider.value = settings.numBots;
        ui.botLabel.textContent = settings.numBots;
        if (ui.botDifficultySelect) ui.botDifficultySelect.value = settings.botDifficulty;
    }

    syncRules(settings = this.game.settings) {
        const ui = this.ui;
        ui.winSlider.value = settings.winsNeeded;
        ui.winLabel.textContent = settings.winsNeeded;
        ui.autoRollToggle.checked = !!settings.autoRoll;
        ui.invertP1.checked = !!settings.invertPitch.PLAYER_1;
        ui.invertP2.checked = !!settings.invertPitch.PLAYER_2;
        ui.cockpitCamP1.checked = !!settings.cockpitCamera.PLAYER_1;
        ui.cockpitCamP2.checked = !!settings.cockpitCamera.PLAYER_2;
        ui.portalsToggle.checked = !!settings.portalsEnabled;
    }

    syncGameplay(settings = this.game.settings) {
        const ui = this.ui;
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
        const mgTrailAimRadius = Number.isFinite(Number(gp.mgTrailAimRadius))
            ? Number(gp.mgTrailAimRadius)
            : Math.max(0.2, Number(CONFIG?.HUNT?.MG?.TRAIL_HIT_RADIUS) || 0.78);
        if (ui.mgTrailAimSlider) ui.mgTrailAimSlider.value = mgTrailAimRadius;
        if (ui.mgTrailAimLabel) ui.mgTrailAimLabel.textContent = mgTrailAimRadius.toFixed(2);
        ui.lockOnLabel.textContent = gp.lockOnAngle + '\u00B0';

        const planarToggle = document.getElementById('planar-mode-toggle');
        if (planarToggle) planarToggle.checked = !!gp.planarMode;
    }

    syncVehicles(settings = this.game.settings) {
        const ui = this.ui;
        if (ui.vehicleSelectP1) ui.vehicleSelectP1.value = settings.vehicles.PLAYER_1;
        if (ui.vehicleSelectP2) ui.vehicleSelectP2.value = settings.vehicles.PLAYER_2;
    }

    updateContext() {
        if (!this.ui.menuContext) return;
        const section = this._getMenuSectionLabel(this.game._activeSubmenu);
        const activeProfile = this._resolveActiveProfileName();
        const dirtyState = this.game.settingsDirty ? 'ungespeicherte Aenderungen' : 'alles gespeichert';
        this.ui.menuContext.textContent = `${section} | Profil: ${activeProfile} | ${dirtyState}`;
    }

    _resolveActiveProfileName() {
        const game = this.game;
        const typedProfile = game.ui?.profileNameInput?.value || '';
        const normalizedTypedProfile = game.profileManager?.normalizeProfileName
            ? game.profileManager.normalizeProfileName(typedProfile)
            : typedProfile.trim();
        return game.activeProfileName || normalizedTypedProfile || 'kein Profil';
    }

    _getMenuSectionLabel(panelId) {
        if (!panelId) return 'Hauptmenue';
        const linkedButton = this._menuButtonByPanel.get(panelId);
        if (linkedButton) {
            return (linkedButton.textContent || '').replace(/\s+/g, ' ').trim();
        }
        const panelTitle = document.querySelector(`#${panelId} .submenu-title`);
        return (panelTitle?.textContent || 'Untermenue').replace(/\s+/g, ' ').trim();
    }

    showToast(message, durationMsOrTone = 1200, tone = 'info') {
        const toast = this.ui.statusToast;
        if (!toast) return;
        const durationMs = typeof durationMsOrTone === 'number' ? durationMsOrTone : 1200;
        const requestedTone = typeof durationMsOrTone === 'string' ? durationMsOrTone : tone;
        const normalizedTone = requestedTone === 'success' || requestedTone === 'error' ? requestedTone : 'info';
        toast.textContent = message;
        toast.classList.remove('hidden', 'show', 'toast-info', 'toast-success', 'toast-error');
        toast.classList.add(`toast-${normalizedTone}`);
        void toast.offsetWidth;
        toast.classList.add('show');
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, durationMs);
    }
}
