import { CONFIG } from './Config.js';
import { applyRuntimeConfigCompatibility } from './RuntimeConfig.js';
import { GAME_MODE_TYPES } from '../hunt/HuntMode.js';
import { MenuController, MENU_CONTROLLER_EVENT_TYPES } from '../ui/MenuController.js';

export class GameRuntimeFacade {
    constructor(game) {
        this.game = game || null;
    }

    applySettingsToRuntime() {
        const game = this.game;
        if (!game?.settingsManager) return;

        game.runtimeConfig = game.settingsManager.createRuntimeConfig(game.settings);

        game.numHumans = game.runtimeConfig.session.numHumans;
        game.numBots = game.runtimeConfig.session.numBots;
        game.mapKey = game.runtimeConfig.session.mapKey;
        game.winsNeeded = game.runtimeConfig.session.winsNeeded;
        game.activeGameMode = game.runtimeConfig?.session?.activeGameMode || GAME_MODE_TYPES.CLASSIC;

        applyRuntimeConfigCompatibility(game.runtimeConfig, CONFIG);

        if (game.arena && game.arena.toggleBeams) {
            game.arena.toggleBeams(game.runtimeConfig.gameplay.portalBeams);
        }
        if (game.entityManager && game.entityManager.setBotDifficulty) {
            game.entityManager.setBotDifficulty(game.runtimeConfig.bot.activeDifficulty);
        }

        game.input?.setBindings?.(game.runtimeConfig.controls);
    }

    setupMenuListeners() {
        const game = this.game;
        game.menuController = new MenuController({
            ui: game.ui,
            settings: game.settings,
            onEvent: (event) => this.handleMenuControllerEvent(event),
        });
        game.menuController.setupListeners();
    }

    handleMenuControllerEvent(event) {
        const game = this.game;
        if (!event?.type) return;

        switch (event.type) {
            case MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED:
                this.onSettingsChanged(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.START_MATCH:
                game.startMatch();
                return;
            case MENU_CONTROLLER_EVENT_TYPES.START_KEY_CAPTURE:
                game.keybindEditorController.startKeyCapture(event.player, event.action);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SAVE_PROFILE:
                game._saveProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.LOAD_PROFILE:
                game._loadProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DELETE_PROFILE:
                game._deleteProfile(event.name);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.RESET_KEYS:
                game.settings.controls = game.settingsManager.cloneDefaultControls();
                this.onSettingsChanged();
                game._showStatusToast('✅ Standard-Tasten wiederhergestellt');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SAVE_KEYS:
                game._saveSettings();
                game._showStatusToast('Einstellungen gespeichert');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.SHOW_STATUS_TOAST:
                game._showStatusToast(event.message, event.duration, event.tone);
                return;
            default:
                return;
        }
    }

    onSettingsChanged(event = null) {
        const game = this.game;
        this.markSettingsDirty(true);
        if (game.uiManager) {
            const changedKeys = Array.isArray(event?.changedKeys) ? event.changedKeys : null;
            if (Array.isArray(changedKeys) && changedKeys.length > 0 && typeof game.uiManager.syncByChangeKeys === 'function') {
                game.uiManager.syncByChangeKeys(changedKeys);
            } else {
                game.uiManager.syncAll();
            }
            game.uiManager.updateContext();
        }
        game.keybindEditorController.renderEditor();
        game._syncProfileControls();
        this.updateSaveButtonState();
    }

    markSettingsDirty(isDirty) {
        const game = this.game;
        game.settingsDirty = !!isDirty;
        this.updateSaveButtonState();
    }

    updateSaveButtonState() {
        const game = this.game;
        if (!game.ui?.saveKeysButton) return;
        game.ui.saveKeysButton.classList.toggle('unsaved', game.settingsDirty);
        game.ui.saveKeysButton.textContent = game.settingsDirty
            ? '💾 Einstellungen explizit speichern *'
            : '💾 Einstellungen explizit speichern';
        game.uiManager?.updateContext();
    }

    syncP2HudVisibility() {
        const game = this.game;
        game.ui?.p2Hud?.classList?.toggle('hidden', game.numHumans !== 2);
    }
}
