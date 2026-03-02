// ============================================
// main.js - entry point and game controller
// ============================================

import { CONFIG } from './Config.js';
import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { InputManager } from './InputManager.js';
import { ParticleSystem } from '../entities/Particles.js';
import { AudioManager } from './Audio.js';
import { HUD } from '../ui/HUD.js';
import { RoundRecorder } from '../state/RoundRecorder.js';
import { VEHICLE_DEFINITIONS } from '../entities/vehicle-registry.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { UIManager } from '../ui/UIManager.js';
import { SettingsManager, KEY_BIND_ACTIONS } from './SettingsManager.js';
import { ProfileManager } from './ProfileManager.js';
import { MenuController, MENU_CONTROLLER_EVENT_TYPES } from '../ui/MenuController.js';
import { deriveProfileControlSelectState } from '../ui/ProfileControlStateOps.js';
import { deriveProfileActionUiState } from '../ui/ProfileUiStateOps.js';
import { createRoundStateController } from '../state/RoundStateController.js';
import { PlayingStateSystem } from './PlayingStateSystem.js';
import { RoundStateTickSystem } from '../state/RoundStateTickSystem.js';
import { HudRuntimeSystem } from '../ui/HudRuntimeSystem.js';
import { CrosshairSystem } from '../ui/CrosshairSystem.js';
import { applyRuntimeConfigCompatibility } from './RuntimeConfig.js';
import { GAME_MODE_TYPES } from '../hunt/HuntMode.js';
import { MatchFlowUiController } from '../ui/MatchFlowUiController.js';

/* global __APP_VERSION__, __BUILD_TIME__, __BUILD_ID__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';


function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export class Game {
    constructor() {
        this.settingsManager = new SettingsManager();
        this.profileManager = new ProfileManager(this.settingsManager.store);

        this.profileDataOps = this.profileManager.getProfileDataOps();
        this.profileUiStateOps = this.profileManager.getProfileUiStateOps();
        this.profileControlStateOps = this.profileManager.getProfileControlStateOps();

        this.settings = this._loadSettings();
        this.settingsProfiles = this.profileManager.getProfiles();
        this.activeProfileName = this.profileManager.getActiveProfileName();
        this.settingsDirty = false;
        this.config = CONFIG;
        this.runtimeConfig = null;
        this.activeGameMode = GAME_MODE_TYPES.CLASSIC;

        this.state = 'MENU';
        this.roundPause = 0;
        this.roundStateController = createRoundStateController({ defaultRoundPause: 3.0 });
        this.playingStateSystem = new PlayingStateSystem(this);
        this.roundStateTickSystem = new RoundStateTickSystem(this);
        this._hudTimer = 0;
        this._adaptiveTimer = 0;
        this._statsTimer = 0;
        this.keyCapture = null;
        this.isLowQuality = false;

        const canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(canvas);
        this.input = new InputManager();
        this.audio = new AudioManager();

        // HUD Systems
        this.hudP1 = new HUD('p1-fighter-hud', 0);
        this.hudP2 = new HUD('p2-fighter-hud', 1);
        this.hudRuntimeSystem = new HudRuntimeSystem(this);
        this.crosshairSystem = new CrosshairSystem(this);
        this.matchFlowUiController = new MatchFlowUiController(this);

        // Debug Recorder
        this.recorder = new RoundRecorder();

        this._applySettingsToRuntime();
        this.input.setBindings(this.settings.controls);

        this.arena = null;
        this.entityManager = null;
        this.powerupManager = null;
        this.particles = new ParticleSystem(this.renderer);

        this.gameLoop = new GameLoop(
            (dt) => this.update(dt),
            () => this.render()
        );

        this.ui = {
            mainMenu: document.getElementById('main-menu'),
            hud: document.getElementById('hud'),
            p2Hud: document.getElementById('p2-hud'),
            p1Score: document.querySelector('#p1-hud .player-score'),
            p2Score: document.querySelector('#p2-hud .player-score'),
            p1Items: document.getElementById('p1-items'),
            p2Items: document.getElementById('p2-items'),
            messageOverlay: document.getElementById('message-overlay'),
            messageText: document.getElementById('message-text'),
            messageSub: document.getElementById('message-sub'),
            statusToast: document.getElementById('status-toast'),
            keybindWarning: document.getElementById('keybind-warning'),
            menuContext: document.getElementById('menu-context'),
            buildInfo: document.getElementById('build-info'),
            buildInfoDetail: document.getElementById('build-info-detail'),
            copyBuildButton: document.getElementById('btn-copy-build'),

            modeButtons: Array.from(document.querySelectorAll('.mode-btn[data-mode]')),
            gameModeButtons: Array.from(document.querySelectorAll('.game-mode-btn')),
            huntRespawnToggle: document.getElementById('hunt-respawn-toggle'),
            huntRespawnRow: document.getElementById('hunt-respawn-row'),
            huntModeHint: document.getElementById('hunt-mode-hint'),
            mapSelect: document.getElementById('map-select'),
            botSlider: document.getElementById('bot-count'),
            botLabel: document.getElementById('bot-count-label'),
            botDifficultySelect: document.getElementById('bot-difficulty'),
            winSlider: document.getElementById('win-count'),
            winLabel: document.getElementById('win-count-label'),
            autoRollToggle: document.getElementById('auto-roll-toggle'),
            invertP1: document.getElementById('invert-p1'),
            invertP2: document.getElementById('invert-p2'),
            cockpitCamP1: document.getElementById('cockpit-cam-p1'),
            cockpitCamP2: document.getElementById('cockpit-cam-p2'),
            portalsToggle: document.getElementById('portals-toggle'),

            speedSlider: document.getElementById('speed-slider'),
            speedLabel: document.getElementById('speed-label'),
            turnSlider: document.getElementById('turn-slider'),
            turnLabel: document.getElementById('turn-label'),
            planeSizeSlider: document.getElementById('plane-size-slider'),
            planeSizeLabel: document.getElementById('plane-size-label'),
            trailWidthSlider: document.getElementById('trail-width-slider'),
            trailWidthLabel: document.getElementById('trail-width-label'),
            gapSizeSlider: document.getElementById('gap-size-slider'),
            gapSizeLabel: document.getElementById('gap-size-label'),
            gapFrequencySlider: document.getElementById('gap-frequency-slider'),
            gapFrequencyLabel: document.getElementById('gap-frequency-label'),
            itemAmountSlider: document.getElementById('item-amount-slider'),
            itemAmountLabel: document.getElementById('item-amount-label'),
            fireRateSlider: document.getElementById('fire-rate-slider'),
            fireRateLabel: document.getElementById('fire-rate-label'),
            lockOnSlider: document.getElementById('lockon-slider'),
            lockOnLabel: document.getElementById('lockon-label'),
            crosshairP1: document.getElementById('crosshair-p1'),
            crosshairP2: document.getElementById('crosshair-p2'),

            keybindP1: document.getElementById('keybind-p1'),
            keybindP2: document.getElementById('keybind-p2'),
            resetKeysButton: document.getElementById('btn-reset-keys'),
            saveKeysButton: document.getElementById('btn-save-keys'),
            profileNameInput: document.getElementById('profile-name'),
            profileSelect: document.getElementById('profile-select'),
            profileSaveButton: document.getElementById('btn-profile-save'),
            profileLoadButton: document.getElementById('btn-profile-load'),
            profileDeleteButton: document.getElementById('btn-profile-delete'),

            vehicleSelectP1: document.getElementById('vehicle-select-p1'),
            vehicleSelectP2: document.getElementById('vehicle-select-p2'),
            vehicleP2Container: document.getElementById('vehicle-p2-container'),

            startButton: document.getElementById('btn-start'),
            openEditorButton: document.getElementById('btn-open-editor'),
            openVehicleEditorButton: document.getElementById('btn-open-vehicle-editor'),
        };

        this._navButtons = [];
        this._menuButtonByPanel = new Map();
        this._activeSubmenu = null;
        this._lastMenuTrigger = null;
        this._buildInfoClipboardText = '';

        this.uiManager = new UIManager(this);
        this.uiManager.init();

        this._setupMenuListeners();
        this._syncProfileControls();
        this._markSettingsDirty(false);
        this._renderBuildInfo();

        this.gameLoop.start();

        window.addEventListener('keydown', (e) => this._handleKeyCapture(e), true);

        // Performance Analyse-Overlay (F) + Quality Toggle (P)
        this._fpsTracker = {
            samples: [], avg: 60, update(dt) {
                if (dt > 0) this.samples.push(1 / dt);
                if (this.samples.length > 60) this.samples.shift();
                this.avg = this.samples.length > 0
                    ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : 60;
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP' && !this.keyCapture) {
                this.isLowQuality = !this.isLowQuality;
                const quality = this.isLowQuality ? 'LOW' : 'HIGH';
                this.renderer.setQuality(quality);
                this._showStatusToast(`Grafik: ${quality === 'LOW' ? 'Niedrig (Schnell)' : 'Hoch (Schön)'}`);
            }
            // Performance Analyse-Overlay (F)
            if (e.code === 'KeyF' && !this.keyCapture) {
                if (!this.stats) {
                    this.stats = document.createElement('div');
                    this.stats.style.cssText = 'position:fixed;top:10px;left:10px;color:#0f0;font:13px/1.5 monospace;z-index:1000;pointer-events:none;background:rgba(0,0,0,0.6);padding:8px 12px;border-radius:6px;min-width:200px;white-space:pre-wrap;';
                    document.body.appendChild(this.stats);
                    this._statsTimer = 0;
                } else {
                    this.stats.remove();
                    this.stats = null;
                }
            }
        });

        this._autoStartPlaytestIfRequested();
    }

    // update() ist weiter unten definiert (einzelne Methode für alles)

    _isPlaytestLaunchRequested() {
        try {
            const params = new URLSearchParams(window.location.search);
            const raw = String(params.get('playtest') || '').toLowerCase();
            return raw === '1' || raw === 'true' || raw === 'yes';
        } catch {
            return false;
        }
    }

    _readPlaytestLaunchBoolParam(paramName) {
        try {
            const params = new URLSearchParams(window.location.search);
            if (!params.has(paramName)) return null;
            const raw = String(params.get(paramName) || '').toLowerCase();
            if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
            if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
            return null;
        } catch {
            return null;
        }
    }

    _autoStartPlaytestIfRequested() {
        if (!this._isPlaytestLaunchRequested()) {
            return;
        }

        this.settings.mapKey = CUSTOM_MAP_KEY;
        const planarRequested = this._readPlaytestLaunchBoolParam('planar');
        if (typeof planarRequested === 'boolean') {
            if (!this.settings.gameplay) this.settings.gameplay = {};
            this.settings.gameplay.planarMode = planarRequested;
            if (planarRequested) {
                if ((this.settings.gameplay.portalCount || 0) === 0) {
                    this.settings.gameplay.portalCount = 4;
                }
                this.settings.portalsEnabled = true;
            }
        }
        this._onSettingsChanged();

        window.setTimeout(() => {
            if (this.state !== 'MENU') return;
            this.startMatch();
        }, 0);
    }

    _formatBuildTime() {
        if (BUILD_TIME === 'dev') {
            return {
                short: 'dev',
                iso: 'dev',
                local: 'Development Build',
            };
        }
        try {
            const date = new Date(BUILD_TIME);
            return {
                short: date.toLocaleDateString(),
                iso: date.toISOString(),
                local: date.toLocaleString(),
            };
        } catch {
            return { short: 'dev', iso: 'dev', local: 'Build-ID: ' + BUILD_ID };
        }
    }

    _showMainNav() {
        if (this.uiManager) {
            this.uiManager.showMainNav();
        }
    }

    _renderBuildInfo() {
        const buildTime = this._formatBuildTime();
        const shortInfo = `v${APP_VERSION} · Build ${BUILD_ID} · ${buildTime.short}`;
        const detailInfo = [
            `Version: v${APP_VERSION}`,
            `Build-ID: ${BUILD_ID}`,
            `Zeit (UTC): ${buildTime.iso}`,
            `Zeit (lokal): ${buildTime.local}`,
        ].join('\n');

        if (this.ui.buildInfo) {
            this.ui.buildInfo.textContent = shortInfo;
        }
        if (this.ui.buildInfoDetail) {
            this.ui.buildInfoDetail.textContent = detailInfo;
        }
        this._buildInfoClipboardText = detailInfo;
    }

    _copyBuildInfoToClipboard() {
        const payload = this._buildInfoClipboardText || `v${APP_VERSION} · Build ${BUILD_ID}`;
        const fallbackCopy = () => {
            const helper = document.createElement('textarea');
            helper.value = payload;
            helper.setAttribute('readonly', 'readonly');
            helper.style.position = 'fixed';
            helper.style.top = '-9999px';
            document.body.appendChild(helper);
            helper.select();
            const copied = document.execCommand('copy');
            document.body.removeChild(helper);
            this._showStatusToast(copied ? 'Build-Info kopiert' : 'Kopieren nicht moeglich', 1400, copied ? 'success' : 'error');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(payload)
                .then(() => this._showStatusToast('Build-Info kopiert', 1400, 'success'))
                .catch(() => fallbackCopy());
            return;
        }

        fallbackCopy();
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

    _updateMenuContext() {
        if (!this.ui.menuContext) return;

        const section = this._getMenuSectionLabel(this._activeSubmenu);
        const activeProfile = this.activeProfileName || this._normalizeProfileName(this.ui.profileNameInput?.value || '') || 'kein Profil';
        const dirtyState = this.settingsDirty ? 'ungespeicherte Aenderungen' : 'alles gespeichert';
        this.ui.menuContext.textContent = `${section} · Profil: ${activeProfile} · ${dirtyState}`;
    }



    _loadSettings() {
        return this.settingsManager.loadSettings();
    }

    _saveSettings() {
        const persisted = this.settingsManager.saveSettings(this.settings);
        if (persisted) {
            this._markSettingsDirty(false);
        }
    }

    _normalizeProfileName(rawName) {
        return this.profileManager.normalizeProfileName(rawName);
    }

    _findProfileIndexByName(profileName) {
        return this.profileManager.findProfileIndexByName(profileName);
    }

    _findProfileByName(profileName) {
        return this.profileManager.findProfileByName(profileName);
    }

    _applySettingsToRuntime() {
        this.runtimeConfig = this.settingsManager.createRuntimeConfig(this.settings);

        this.numHumans = this.runtimeConfig.session.numHumans;
        this.numBots = this.runtimeConfig.session.numBots;
        this.mapKey = this.runtimeConfig.session.mapKey;
        this.winsNeeded = this.runtimeConfig.session.winsNeeded;
        this.activeGameMode = this.runtimeConfig?.session?.activeGameMode || GAME_MODE_TYPES.CLASSIC;

        applyRuntimeConfigCompatibility(this.runtimeConfig, CONFIG);

        // Apply immediately if arena/entity manager are already alive.
        if (this.arena && this.arena.toggleBeams) {
            this.arena.toggleBeams(this.runtimeConfig.gameplay.portalBeams);
        }
        if (this.entityManager && this.entityManager.setBotDifficulty) {
            this.entityManager.setBotDifficulty(this.runtimeConfig.bot.activeDifficulty);
        }

        this.input.setBindings(this.runtimeConfig.controls);
    }

    _setupMenuListeners() {
        this.menuController = new MenuController({
            ui: this.ui,
            settings: this.settings,
            onEvent: (event) => this._handleMenuControllerEvent(event),
        });

        this.menuController.setupListeners();
    }

    _handleMenuControllerEvent(event) {
        if (!event?.type) return;

        switch (event.type) {
            case MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED:
                this._onSettingsChanged();
                return;
            case MENU_CONTROLLER_EVENT_TYPES.START_MATCH:
                this.startMatch();
                return;
            case MENU_CONTROLLER_EVENT_TYPES.START_KEY_CAPTURE:
                this._startKeyCapture(event.player, event.action);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SAVE_PROFILE:
                this._saveProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.LOAD_PROFILE:
                this._loadProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DELETE_PROFILE:
                this._deleteProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.RESET_KEYS:
                this.settings.controls = this._cloneDefaultControls();
                this._onSettingsChanged();
                this._showStatusToast('✅ Standard-Tasten wiederhergestellt');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SAVE_KEYS:
                this._saveSettings();
                this._showStatusToast('Einstellungen gespeichert');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SHOW_STATUS_TOAST:
                this._showStatusToast(event.message, event.duration, event.tone);
                return;
            default:
                return;
        }
    }

    _onSettingsChanged() {
        this._markSettingsDirty(true);
        if (this.uiManager) {
            this.uiManager.syncAll();
            this.uiManager.updateContext();
        }
        this._renderKeybindEditor();
        this._syncProfileControls();
        this._updateSaveButtonState();
    }

    _markSettingsDirty(isDirty) {
        this.settingsDirty = !!isDirty;
        this._updateSaveButtonState();
    }

    _updateSaveButtonState() {
        if (!this.ui?.saveKeysButton) return;
        this.ui.saveKeysButton.classList.toggle('unsaved', this.settingsDirty);
        this.ui.saveKeysButton.textContent = this.settingsDirty
            ? '💾 Einstellungen explizit speichern *'
            : '💾 Einstellungen explizit speichern';
        this._updateMenuContext();
    }

    _syncProfileControls() {
        if (!this.ui.profileSelect) return;

        const controlState = deriveProfileControlSelectState(
            this.settingsProfiles,
            {
                activeProfileName: this.activeProfileName,
                selectValue: this.ui.profileSelect.value,
                isProfileNameInputFocused: this.ui.profileNameInput
                    ? document.activeElement?.isSameNode(this.ui.profileNameInput)
                    : false,
            },
            this.profileControlStateOps
        );
        this.ui.profileSelect.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = controlState.placeholderOption.value;
        placeholder.textContent = controlState.placeholderOption.text;
        this.ui.profileSelect.appendChild(placeholder);

        for (const optionData of controlState.profileOptions) {
            const opt = document.createElement('option');
            opt.value = optionData.value;
            opt.textContent = optionData.text;
            this.ui.profileSelect.appendChild(opt);
        }

        const validSelected = controlState.resolvedActiveProfileName;
        this.activeProfileName = validSelected;
        this.ui.profileSelect.value = validSelected;

        if (this.ui.profileNameInput && controlState.shouldMirrorProfileNameInput) {
            this.ui.profileNameInput.value = validSelected;
        }
        this._syncProfileActionState();
    }

    _syncProfileActionState() {
        const effectiveActiveProfileName = this.profileManager.resolveActiveProfileName(
            this.activeProfileName || this.ui.profileSelect?.value || ''
        );
        const actionState = deriveProfileActionUiState(
            this.settingsProfiles,
            {
                selectedProfileName: this.ui.profileSelect?.value || this.activeProfileName || '',
                typedName: this.ui.profileNameInput?.value || '',
                activeProfileName: effectiveActiveProfileName,
            },
            this.profileUiStateOps
        );

        if (this.ui.profileLoadButton) {
            this.ui.profileLoadButton.disabled = !actionState.canLoadProfile;
        }
        if (this.ui.profileDeleteButton) {
            this.ui.profileDeleteButton.disabled = !actionState.canDeleteProfile;
        }
        if (this.ui.profileSaveButton) {
            this.ui.profileSaveButton.disabled = !actionState.canSaveProfile;
            this.ui.profileSaveButton.textContent = actionState.saveButtonLabel;
        }
        this._updateMenuContext();
    }

    _saveProfile(profileName) {
        const result = this.profileManager.saveProfile(profileName, this.settings, this.activeProfileName);
        if (!result.success) {
            this._showStatusToast(result.error, 2000, 'error');
            return false;
        }

        this.settingsProfiles = this.profileManager.getProfiles();
        this.activeProfileName = this.profileManager.getActiveProfileName();

        if (this.ui.profileNameInput) {
            this.ui.profileNameInput.value = result.name;
        }

        this._syncProfileControls();

        this._showStatusToast(
            result.isUpdate ? `Profil aktualisiert: ${result.name}` : `Profil gespeichert: ${result.name}`,
            1500,
            'success'
        );
        return true;
    }

    _loadProfile(profileName) {
        const result = this.profileManager.loadProfile(profileName);
        if (!result.success) {
            this._showStatusToast(result.error, 1500, 'error');
            return false;
        }

        this.settings = result.profile.settings;
        this.activeProfileName = this.profileManager.getActiveProfileName();
        this._onSettingsChanged();
        this._markSettingsDirty(false);
        this._showStatusToast(`Profil geladen: ${result.profile.name}`, 1400, 'success');
        return true;
    }

    _deleteProfile(profileName) {
        const result = this.profileManager.deleteProfile(profileName);
        if (!result.success) {
            this._showStatusToast(result.error, 1700, 'error');
            return false;
        }

        this.settingsProfiles = this.profileManager.getProfiles();
        this.activeProfileName = this.profileManager.getActiveProfileName();
        this._syncProfileControls();

        this._showStatusToast(`Profil geloescht: ${result.removedName}`, 1400, 'success');
        return true;
    }

    _renderKeybindEditor() {
        const conflicts = this._collectKeyConflicts();
        this._renderKeybindRows('PLAYER_1', this.ui.keybindP1, conflicts);
        this._renderKeybindRows('PLAYER_2', this.ui.keybindP2, conflicts);
        this._updateKeyConflictWarning(conflicts);
    }

    _renderKeybindRows(playerKey, container, conflicts) {
        container.innerHTML = '';

        for (const action of KEY_BIND_ACTIONS) {
            const row = document.createElement('div');
            row.className = 'key-row';

            const label = document.createElement('div');
            label.className = 'key-action';
            label.textContent = action.label;

            const value = this._getControlValue(playerKey, action.key);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'keybind-btn';
            button.dataset.action = action.key;
            const isConflict = !!value && (conflicts.get(value) || 0) > 1;
            button.textContent = this._formatKeyCode(value) + (isConflict ? '  (Konflikt)' : '');
            if (isConflict) {
                row.classList.add('conflict');
                button.classList.add('conflict');
            }

            if (this.keyCapture && this.keyCapture.playerKey === playerKey && this.keyCapture.actionKey === action.key) {
                button.classList.add('listening');
                button.textContent = 'Taste druecken...';
            }

            row.appendChild(label);
            row.appendChild(button);
            container.appendChild(row);
        }
    }

    _startKeyCapture(playerKey, actionKey) {
        this.keyCapture = { playerKey, actionKey };
        this._renderKeybindEditor();
    }

    _handleKeyCapture(event) {
        if (!this.keyCapture || this.ui.mainMenu.classList.contains('hidden')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.code === 'Escape') {
            this.keyCapture = null;
            this._renderKeybindEditor();
            return;
        }

        this._setControlValue(this.keyCapture.playerKey, this.keyCapture.actionKey, event.code);
        this.keyCapture = null;
        this._onSettingsChanged();
        this._showStatusToast('✅ Taste gespeichert!');
    }

    _getControlValue(playerKey, actionKey) {
        return this.settings.controls[playerKey][actionKey] || '';
    }

    _setControlValue(playerKey, actionKey, value) {
        this.settings.controls[playerKey][actionKey] = value;
    }

    _collectKeyConflicts() {
        const counts = new Map();
        for (const playerKey of ['PLAYER_1', 'PLAYER_2']) {
            for (const action of KEY_BIND_ACTIONS) {
                const code = this._getControlValue(playerKey, action.key);
                if (!code) continue;
                counts.set(code, (counts.get(code) || 0) + 1);
            }
        }
        return counts;
    }

    _updateKeyConflictWarning(conflicts) {
        const conflictCodes = Array.from(conflicts.entries())
            .filter(([, count]) => count > 1)
            .map(([code]) => this._formatKeyCode(code));

        if (conflictCodes.length === 0) {
            this.ui.keybindWarning.classList.add('hidden');
            this.ui.keybindWarning.textContent = '';
            return;
        }

        this.ui.keybindWarning.classList.remove('hidden');
        this.ui.keybindWarning.textContent = `Achtung: Mehrfachbelegte Tasten: ${conflictCodes.join(', ')}`;
    }

    _formatKeyCode(code) {
        if (!code) return '-';

        const named = {
            ArrowUp: 'Arrow Up',
            ArrowDown: 'Arrow Down',
            ArrowLeft: 'Arrow Left',
            ArrowRight: 'Arrow Right',
            ShiftLeft: 'Shift Left',
            ShiftRight: 'Shift Right',
            Space: 'Space',
            Enter: 'Enter',
            Escape: 'Escape',
            ControlLeft: 'Ctrl Left',
            ControlRight: 'Ctrl Right',
            AltLeft: 'Alt Left',
            AltRight: 'Alt Right',
        };

        if (named[code]) {
            return named[code];
        }
        if (code.startsWith('Key')) {
            return code.slice(3);
        }
        if (code.startsWith('Digit')) {
            return code.slice(5);
        }
        if (code.startsWith('Numpad')) {
            return `Num ${code.slice(6)}`;
        }
        return code;
    }

    _showStatusToast(message, durationMs = 1200, tone = 'info') {
        if (!this.ui.statusToast) return;

        const normalizedTone = tone === 'success' || tone === 'error' ? tone : 'info';
        this.ui.statusToast.textContent = message;
        this.ui.statusToast.classList.remove('hidden', 'show', 'toast-info', 'toast-success', 'toast-error');
        this.ui.statusToast.classList.add(`toast-${normalizedTone}`);
        // Restart animation on repeated calls.
        void this.ui.statusToast.offsetWidth;
        this.ui.statusToast.classList.add('show');

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        this.toastTimeout = setTimeout(() => {
            this.ui.statusToast.classList.remove('show');
            this.ui.statusToast.classList.add('hidden');
        }, durationMs);
    }

    _showPlayerFeedback(player, message) {
        if (!player) return;
        const prefix = player.isBot ? `Bot ${player.index + 1}` : `P${player.index + 1}`;
        this._showStatusToast(`${prefix}: ${message}`);
    }

    _getDeathMessage(cause) {
        const messages = {
            'WALL': 'Kollision mit der Wand!',
            'TRAIL_SELF': 'Eigener Schweif getroffen!',
            'TRAIL_OTHER': 'Gegnerischer Schweif getroffen!',
            'PROJECTILE': 'Abgeschossen!',
            'OUT_OF_BOUNDS': 'Arena verlassen!',
            'UNKNOWN': 'Unbekannte Todesursache'
        };
        return messages[cause] || messages['UNKNOWN'];
    }

    _syncP2HudVisibility() {
        this.ui.p2Hud.classList.toggle('hidden', this.numHumans !== 2);
    }

    _applyMatchUiState(uiState) {
        this.matchFlowUiController.applyMatchUiState(uiState);
    }

    _applyMatchStartUiState(uiState) {
        this.matchFlowUiController.applyMatchStartUiState(uiState);
    }

    _applyInitializedMatchSession(initializedMatch) {
        const matchSession = initializedMatch?.session;
        if (!matchSession) return;

        this.particles = matchSession.particles;
        this.arena = matchSession.arena;
        this.powerupManager = matchSession.powerupManager;
        this.entityManager = matchSession.entityManager;
        this.mapKey = matchSession.effectiveMapKey;
        this.numHumans = matchSession.numHumans;
        this.numBots = matchSession.numBots;
        this.winsNeeded = matchSession.winsNeeded;
    }

    _getCurrentMatchSessionRefs() {
        return {
            entityManager: this.entityManager,
            powerupManager: this.powerupManager,
            particles: this.particles,
        };
    }

    _clearMatchSessionRefs() {
        this.particles = null;
        this.arena = null;
        this.entityManager = null;
        this.powerupManager = null;
    }

    _applyMatchFeedbackPlan(feedbackPlan) {
        if (!feedbackPlan) return;
        for (const entry of feedbackPlan.consoleEntries || []) {
            const level = entry?.level === 'warn' ? 'warn' : 'log';
            const args = Array.isArray(entry?.args) ? entry.args : [entry];
            console[level](...args);
        }
        for (const toast of feedbackPlan.toasts || []) {
            this._showStatusToast(toast.message, toast.durationMs, toast.tone);
        }
    }

    _resetCrosshairElementUi(element) {
        this.matchFlowUiController.resetCrosshairElementUi(element);
    }

    _resetCrosshairUi() {
        this.matchFlowUiController.resetCrosshairUi();
    }

    startMatch() {
        this.matchFlowUiController.startMatch();
    }

    _startRound() {
        this.matchFlowUiController.startRound();
    }

    _onRoundEnd(winner) {
        this.matchFlowUiController.onRoundEnd(winner);
    }

    _buildRoundEndCoordinatorRequest(winner) {
        return this.matchFlowUiController.buildRoundEndCoordinatorRequest(winner);
    }

    _applyRoundEndCoordinatorPlan(roundEndPlan) {
        this.matchFlowUiController.applyRoundEndCoordinatorPlan(roundEndPlan);
    }

    _applyRoundEndCoordinatorEffects(effectsPlan) {
        this.matchFlowUiController.applyRoundEndCoordinatorEffects(effectsPlan);
    }

    _applyRoundEndCoordinatorUiState(uiState) {
        this.matchFlowUiController.applyRoundEndCoordinatorUiState(uiState);
    }

    _applyRoundEndControllerTransitionState(roundEndTransition) {
        this.matchFlowUiController.applyRoundEndControllerTransitionState(roundEndTransition);
    }

    _getPlanarAimAxis(playerIndex) {
        const controls = this.settings.controls;
        const p1 = controls.PLAYER_1;
        const p2 = controls.PLAYER_2;

        let up = false;
        let down = false;

        if (this.numHumans === 1 && playerIndex === 0) {
            up = this.input.isDown(p1.UP) || this.input.isDown(p2.UP);
            down = this.input.isDown(p1.DOWN) || this.input.isDown(p2.DOWN);
        } else {
            const map = playerIndex === 0 ? p1 : p2;
            up = this.input.isDown(map.UP);
            down = this.input.isDown(map.DOWN);
        }

        return (down ? 1 : 0) - (up ? 1 : 0);
    }

    _updatePlanarAimAssist(dt) {
        if (!this.entityManager) return;

        const gameplayConfig = this.runtimeConfig?.gameplay;
        const inputSpeed = gameplayConfig?.planarAimInputSpeed || CONFIG.GAMEPLAY.PLANAR_AIM_INPUT_SPEED || 1.5;
        const returnSpeed = gameplayConfig?.planarAimReturnSpeed || CONFIG.GAMEPLAY.PLANAR_AIM_RETURN_SPEED || 0.6;
        const isPlanar = gameplayConfig?.planarMode ?? !!CONFIG.GAMEPLAY.PLANAR_MODE;

        for (const player of this.entityManager.getHumanPlayers()) {
            const axis = isPlanar ? this._getPlanarAimAxis(player.index) : 0;
            let offset = player.planarAimOffset || 0;

            if (axis !== 0) {
                offset += axis * inputSpeed * dt;
            } else {
                const recover = 1 - Math.exp(-returnSpeed * dt);
                offset += (0 - offset) * recover;
            }

            player.planarAimOffset = clamp(offset, -1, 1);
        }
    }

    _applyPlayingTimeScaleFromEffects() {
        this.gameLoop.setTimeScale(1.0);
        for (const p of this.entityManager.players) {
            for (const effect of p.activeEffects) {
                if (effect.type === 'SLOW_TIME') {
                    this.gameLoop.setTimeScale(CONFIG.POWERUP.TYPES.SLOW_TIME.timeScale);
                }
            }
        }
    }

    _updatePlayingState(dt) {
        this.playingStateSystem.update(dt);
    }

    _updateRoundEndState(dt) {
        this.roundStateTickSystem.updateRoundEnd(dt);
    }

    _updateMatchEndState(dt) {
        this.roundStateTickSystem.updateMatchEnd(dt);
    }

    update(dt) {
        // FPS-Tracker (immer aktiv, kein Performance-Overhead)
        this._fpsTracker.update(dt);

        // Debug Recording
        if (this.state === 'PLAYING' && this.entityManager) {
            this.recorder.recordFrame(this.entityManager.players);
        }

        // Performance Analyse-Overlay aktualisieren (alle 250ms)
        if (this.stats) {
            this._statsTimer = (this._statsTimer || 0) + dt;
            if (this._statsTimer >= 0.25) {
                this._statsTimer = 0;
                const info = this.renderer.renderer.info;
                const fps = Math.round(this._fpsTracker.avg);
                const draws = info.render.calls || 0;
                const tris = info.render.triangles || 0;
                const geos = info.memory.geometries || 0;
                const texs = info.memory.textures || 0;
                const players = this.entityManager ? this.entityManager.players.filter(p => p.alive).length : 0;
                const quality = this.isLowQuality ? 'LOW' : 'HIGH';
                this.stats.innerHTML =
                    `<b style="color:${fps < 30 ? '#f44' : fps < 50 ? '#fa0' : '#0f0'}">FPS: ${fps}</b>\n` +
                    `Draw Calls: ${draws}\n` +
                    `Dreiecke: ${(tris / 1000).toFixed(1)}k\n` +
                    `Geometrien: ${geos}\n` +
                    `Texturen: ${texs}\n` +
                    `Spieler: ${players}\n` +
                    `Qualität: ${quality}`;
            }
        }

        // Adaptive Qualität: Auto-Switch auf LOW bei < 30 FPS
        this._adaptiveTimer = (this._adaptiveTimer || 0) + dt;
        if (this._adaptiveTimer >= 3.0) {
            this._adaptiveTimer = 0;
            if (this._fpsTracker.avg < 30 && !this.isLowQuality && this.state === 'PLAYING') {
                this.isLowQuality = true;
                this.renderer.setQuality('LOW');
                this._showStatusToast('⚡ Grafik automatisch reduziert');
            }
        }

        if (this.state === 'PLAYING') {
            this._updatePlayingState(dt);
        } else if (this.state === 'ROUND_END') {
            this._updateRoundEndState(dt);
        } else if (this.state === 'MATCH_END') {
            this._updateMatchEndState(dt);
        }
    }

    render() {
        this.renderer.render();
    }

    _returnToMenu() {
        this.matchFlowUiController.returnToMenu();
    }
    _showDebugLog(recorderDump) {
        // Disabled
    }

    captureBotBaseline(label = 'BASELINE') {
        const normalized = String(label || 'BASELINE').toUpperCase();
        const baseline = this.recorder.captureBaseline(normalized);
        this._showStatusToast(`Bot-Baseline gespeichert: ${normalized}`);
        console.log(`[Recorder] Baseline gespeichert (${normalized}):`, baseline);
        return baseline;
    }

    printBotValidationReport(label = 'BASELINE') {
        const normalized = String(label || 'BASELINE').toUpperCase();
        const aggregate = this.recorder.getAggregateMetrics();
        const comparison = this.recorder.compareWithBaseline(normalized);
        const matrix = this.recorder.getValidationMatrix();
        const report = {
            label: normalized,
            aggregate,
            comparison,
            matrix,
        };
        console.log('[Recorder] Validation report:', report);
        return report;
    }

    getBotValidationMatrix() {
        return this.recorder.getValidationMatrix();
    }

    printBotTestProtocol() {
        const matrix = this.getBotValidationMatrix();
        const protocol = {
            steps: [
                '1) applyBotValidationScenario(0) und 10 Runden spielen.',
                '2) captureBotBaseline(\"BASELINE\") ausfuehren.',
                '3) Weitere Szenarien aus der Matrix durchspielen.',
                '4) printBotValidationReport(\"BASELINE\") fuer KPI-Vergleich ausfuehren.',
            ],
            matrix,
        };
        console.log('[Recorder] Bot-Testprotokoll:', protocol);
        return protocol;
    }

    applyBotValidationScenario(idOrIndex = 0) {
        const matrix = this.getBotValidationMatrix();
        if (!matrix || matrix.length === 0) return null;

        let scenario = null;
        if (typeof idOrIndex === 'number') {
            scenario = matrix[Math.max(0, Math.min(matrix.length - 1, idOrIndex))];
        } else {
            scenario = matrix.find((s) => s.id === idOrIndex) || matrix[0];
        }
        if (!scenario) return null;

        this.settings.mode = scenario.mode === '2p' ? '2p' : '1p';
        this.settings.numBots = scenario.bots;
        this.settings.mapKey = scenario.mapKey;
        this.settings.gameplay.planarMode = !!scenario.planarMode;
        this.settings.gameplay.portalCount = scenario.portalCount;
        this.settings.portalsEnabled = scenario.portalCount > 0 || this.settings.portalsEnabled;
        this.settings.winsNeeded = Math.max(1, this.settings.winsNeeded);
        this._onSettingsChanged();

        this._showStatusToast(`Szenario ${scenario.id} geladen`);
        console.log('[Recorder] Validation scenario loaded:', scenario);
        return scenario;
    }
}

// Global Error Handling
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(50,0,0,0.9);color:#fff;padding:20px;z-index:99999;font-family:monospace;overflow:auto;';
    overlay.innerHTML = `<h1>CRITICAL ERROR</h1><p>${msg}</p><p>${url}:${lineNo}:${columnNo}</p><pre>${error ? error.stack : 'No stack trace'}</pre>`;
    document.body.appendChild(overlay);
    return false;
};

window.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('DOM ready, initializing Game...');
        const game = new Game();
        // Global access for debugging
        window.GAME_INSTANCE = game;
    } catch (err) {
        console.error('Fatal Game Init Error:', err);
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(50,0,0,0.9);color:#fff;padding:20px;z-index:99999;font-family:monospace;overflow:auto;';
        overlay.innerHTML = `<h1>INIT ERROR</h1><p>${err.message}</p><pre>${err.stack}</pre>`;
        document.body.appendChild(overlay);
    }
});
