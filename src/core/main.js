// ============================================
// main.js - entry point and game controller
// ============================================

import { CONFIG } from './Config.js';
import { RoundRecorder } from '../state/RoundRecorder.js';
import { CUSTOM_MAP_KEY } from '../entities/MapSchema.js';
import { UIManager } from '../ui/UIManager.js';
import { SettingsManager } from './SettingsManager.js';
import { ProfileManager } from './ProfileManager.js';
import { deriveProfileControlSelectState } from '../ui/ProfileControlStateOps.js';
import { deriveProfileActionUiState } from '../ui/ProfileUiStateOps.js';
import { createRoundStateController } from '../state/RoundStateController.js';
import { PlayingStateSystem } from './PlayingStateSystem.js';
import { RoundStateTickSystem } from '../state/RoundStateTickSystem.js';
import { GAME_MODE_TYPES } from '../hunt/HuntMode.js';
import { bootstrapGameRuntime } from './GameBootstrap.js';
import { GameRuntimeFacade } from './GameRuntimeFacade.js';
import { GameDebugApi } from './GameDebugApi.js';

/* global __APP_VERSION__, __BUILD_TIME__, __BUILD_ID__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

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
        this.huntState = {
            overheatByPlayer: {},
            killFeed: [],
            damageIndicator: null,
        };

        this.state = 'MENU';
        this.roundPause = 0;
        this.roundStateController = createRoundStateController({ defaultRoundPause: 3.0 });
        this.playingStateSystem = new PlayingStateSystem(this);
        this.roundStateTickSystem = new RoundStateTickSystem(this);
        this._hudTimer = 0;
        this.keyCapture = null;

        bootstrapGameRuntime(this, {
            appVersion: APP_VERSION,
            buildId: BUILD_ID,
            buildTime: BUILD_TIME,
            showStatusToast: (message, durationMs, tone) => this._showStatusToast(message, durationMs, tone),
        });
        this.runtimeFacade = new GameRuntimeFacade(this);
        this.debugApi = new GameDebugApi(this);

        // Debug Recorder
        this.recorder = new RoundRecorder();
        this._recorderFrameCaptureEnabled = this._resolveRecorderFrameCaptureEnabledDefault();
        this.recorder.setFrameCaptureEnabled(this._recorderFrameCaptureEnabled);

        this._applySettingsToRuntime();
        this.input.setBindings(this.settings.controls);

        this.arena = null;
        this.entityManager = null;
        this.powerupManager = null;

        this.uiManager = new UIManager(this);
        this.uiManager.init();

        this._setupMenuListeners();
        this._syncProfileControls();
        this._markSettingsDirty(false);
        this._renderBuildInfo();
        if (this.ui?.mainMenu) {
            this.ui.mainMenu.style.visibility = '';
        }

        this.gameLoop.start();

        window.addEventListener('keydown', (e) => this.keybindEditorController.handleKeyCapture(e), true);

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
        return this.buildInfoController.formatBuildTime();
    }

    _showMainNav() {
        if (this.uiManager) {
            this.uiManager.showMainNav();
        }
    }

    _renderBuildInfo() {
        this._buildInfoClipboardText = this.buildInfoController.renderBuildInfo();
    }

    _copyBuildInfoToClipboard() {
        this.buildInfoController.copyBuildInfoToClipboard(this._buildInfoClipboardText);
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
        this.runtimeFacade.applySettingsToRuntime();
    }

    _setupMenuListeners() {
        this.runtimeFacade.setupMenuListeners();
    }

    _handleMenuControllerEvent(event) {
        this.runtimeFacade.handleMenuControllerEvent(event);
    }

    _onSettingsChanged(event = null) {
        this.runtimeFacade.onSettingsChanged(event);
    }

    _markSettingsDirty(isDirty) {
        this.runtimeFacade.markSettingsDirty(isDirty);
    }

    _updateSaveButtonState() {
        this.runtimeFacade.updateSaveButtonState();
    }

    _cloneDefaultControls() {
        return this.settingsManager.cloneDefaultControls();
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
        this.uiManager?.updateContext();
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
        this.keybindEditorController.renderEditor();
    }

    _renderKeybindRows(playerKey, container, conflicts) {
        this.keybindEditorController.renderKeybindRows(playerKey, container, conflicts);
    }

    _startKeyCapture(playerKey, actionKey) {
        this.keybindEditorController.startKeyCapture(playerKey, actionKey);
    }

    _handleKeyCapture(event) {
        this.keybindEditorController.handleKeyCapture(event);
    }

    _getControlValue(playerKey, actionKey) {
        return this.keybindEditorController.getControlValue(playerKey, actionKey);
    }

    _setControlValue(playerKey, actionKey, value) {
        this.keybindEditorController.setControlValue(playerKey, actionKey, value);
    }

    _collectKeyConflicts() {
        return this.keybindEditorController.collectKeyConflicts();
    }

    _updateKeyConflictWarning(conflicts) {
        this.keybindEditorController.updateKeyConflictWarning(conflicts);
    }

    _formatKeyCode(code) {
        return this.keybindEditorController.formatKeyCode(code);
    }

    _showStatusToast(message, durationMs = 1200, tone = 'info') {
        if (!this.uiManager || typeof this.uiManager.showToast !== 'function') return;
        this.uiManager.showToast(message, durationMs, tone);
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
        this.runtimeFacade.syncP2HudVisibility();
    }

    _applyMatchUiState(uiState) {
        this.matchFlowUiController.applyMatchUiState(uiState);
    }

    _applyMatchStartUiState(uiState) {
        this.matchFlowUiController.applyMatchStartUiState(uiState);
    }

    _applyInitializedMatchSession(initializedMatch) {
        this.matchSessionRuntimeBridge.applyInitializedMatchSession(initializedMatch);
    }

    _getCurrentMatchSessionRefs() {
        return this.matchSessionRuntimeBridge.getCurrentMatchSessionRefs();
    }

    _clearMatchSessionRefs() {
        this.matchSessionRuntimeBridge.clearMatchSessionRefs();
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
        return this.planarAimAssistSystem.getPlanarAimAxis(playerIndex);
    }

    _updatePlanarAimAssist(dt) {
        this.planarAimAssistSystem.updatePlanarAimAssist(dt);
    }

    _applyPlayingTimeScaleFromEffects() {
        this.planarAimAssistSystem.applyPlayingTimeScaleFromEffects();
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

    _resolveRecorderFrameCaptureEnabledDefault() {
        return this.debugApi.resolveRecorderFrameCaptureEnabledDefault();
    }

    setRecorderFrameCaptureEnabled(enabled) {
        this.debugApi.setRecorderFrameCaptureEnabled(enabled);
    }

    update(dt) {
        this.runtimeDiagnosticsSystem.update(dt);

        // Debug Recording
        if (this._recorderFrameCaptureEnabled && this.state === 'PLAYING' && this.entityManager) {
            this.recorder.recordFrame(this.entityManager.players);
        }

        if (this.state === 'PLAYING') {
            this._updatePlayingState(dt);
        } else if (this.state === 'ROUND_END') {
            this._updateRoundEndState(dt);
        } else if (this.state === 'MATCH_END') {
            this._updateMatchEndState(dt);
        }

        if (this.huntHud) {
            this.huntHud.update(dt);
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
        return this.debugApi.captureBotBaseline(label);
    }

    printBotValidationReport(label = 'BASELINE') {
        return this.debugApi.printBotValidationReport(label);
    }

    getBotValidationMatrix() {
        return this.debugApi.getBotValidationMatrix();
    }

    printBotTestProtocol() {
        return this.debugApi.printBotTestProtocol();
    }

    applyBotValidationScenario(idOrIndex = 0) {
        return this.debugApi.applyBotValidationScenario(idOrIndex);
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
