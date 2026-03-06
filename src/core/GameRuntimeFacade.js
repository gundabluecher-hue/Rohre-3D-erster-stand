import { CONFIG } from './Config.js';
import { applyRuntimeConfigCompatibility } from './RuntimeConfig.js';
import { GAME_MODE_TYPES } from '../hunt/HuntMode.js';
import {
    MenuController,
    MENU_CONTROLLER_EVENT_CONTRACT_VERSION,
    MENU_CONTROLLER_EVENT_TYPES,
} from '../ui/MenuController.js';
import { SETTINGS_CHANGE_KEYS } from '../ui/SettingsChangeKeys.js';
import { guardMenuRuntimeEvent, resolveMenuAccessContext } from '../ui/menu/MenuAccessPolicy.js';
import { MenuMultiplayerBridge } from '../ui/menu/MenuMultiplayerBridge.js';

const MATCH_SETTING_CHANGE_KEY_SET = new Set([
    SETTINGS_CHANGE_KEYS.MODE,
    SETTINGS_CHANGE_KEYS.GAME_MODE,
    SETTINGS_CHANGE_KEYS.MAP_KEY,
    SETTINGS_CHANGE_KEYS.BOTS_COUNT,
    SETTINGS_CHANGE_KEYS.BOTS_DIFFICULTY,
    SETTINGS_CHANGE_KEYS.RULES_WINS_NEEDED,
    SETTINGS_CHANGE_KEYS.RULES_AUTO_ROLL,
    SETTINGS_CHANGE_KEYS.RULES_PORTALS_ENABLED,
    SETTINGS_CHANGE_KEYS.HUNT_RESPAWN_ENABLED,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_SPEED,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_TURN_SENSITIVITY,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANE_SCALE,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_TRAIL_WIDTH,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_GAP_SIZE,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_GAP_FREQUENCY,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_ITEM_AMOUNT,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_FIRE_RATE,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_LOCK_ON_ANGLE,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_MG_TRAIL_AIM_RADIUS,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANAR_MODE,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_PORTAL_COUNT,
    SETTINGS_CHANGE_KEYS.GAMEPLAY_PLANAR_LEVEL_COUNT,
]);

export class GameRuntimeFacade {
    constructor(game) {
        this.game = game || null;
        this.menuMultiplayerBridge = null;
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
        if (!game.menuMultiplayerBridge) {
            game.menuMultiplayerBridge = new MenuMultiplayerBridge({
                contractVersion: game?.menuLifecycleContractVersion || 'lifecycle.v1',
                onEvent: (lifecycleEvent) => game._handleMenuLifecycleEvent?.(lifecycleEvent),
                onStatus: (message) => game._showStatusToast(message, 1300, 'info'),
            });
        }
        this.menuMultiplayerBridge = game.menuMultiplayerBridge;

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
        if (event.contractVersion && event.contractVersion !== MENU_CONTROLLER_EVENT_CONTRACT_VERSION) {
            game._showStatusToast('Menu-Event-Contract mismatch.', 1800, 'error');
            return;
        }
        const accessResult = guardMenuRuntimeEvent(event.type, this._resolveMenuAccessContext());
        if (!accessResult.allowed) {
            game._showStatusToast('Aktion gesperrt (owner-only).', 1600, 'error');
            return;
        }

        switch (event.type) {
            case MENU_CONTROLLER_EVENT_TYPES.SETTINGS_CHANGED:
                this.onSettingsChanged(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.START_MATCH:
                this.startMatch();
                return;
            case MENU_CONTROLLER_EVENT_TYPES.PRESET_APPLY:
                this.applyMenuPreset(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.PRESET_SAVE_OPEN:
                this.saveMenuPreset(event, 'open');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.PRESET_SAVE_FIXED:
                this.saveMenuPreset(event, 'fixed');
                return;
            case MENU_CONTROLLER_EVENT_TYPES.PRESET_DELETE:
                this.deleteMenuPreset(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.MULTIPLAYER_HOST:
                this.handleMultiplayerHost(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.MULTIPLAYER_JOIN:
                this.handleMultiplayerJoin(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.MULTIPLAYER_READY_TOGGLE:
                this.handleMultiplayerReadyToggle(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DEVELOPER_MODE_TOGGLE:
                this.handleDeveloperModeToggle(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DEVELOPER_THEME_CHANGE:
                this.handleDeveloperThemeChange(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DEVELOPER_VISIBILITY_CHANGE:
                this.handleDeveloperVisibilityChange(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DEVELOPER_FIXED_PRESET_LOCK_TOGGLE:
                this.handleDeveloperFixedPresetLockToggle(event);
                return;
            case MENU_CONTROLLER_EVENT_TYPES.DEVELOPER_ACTOR_CHANGE:
                this.handleDeveloperActorChange(event);
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

    _resolveMenuAccessContext() {
        return resolveMenuAccessContext(this.game?.settings);
    }

    applyMenuPreset(event) {
        const game = this.game;
        const presetId = String(event?.presetId || '').trim();
        if (!presetId) {
            game._showStatusToast('Preset fehlt.', 1500, 'error');
            return;
        }

        const result = game.settingsManager.applyMenuPreset(game.settings, presetId, this._resolveMenuAccessContext());
        if (!result.success) {
            game._showStatusToast('Preset konnte nicht angewendet werden.', 1700, 'error');
            return;
        }

        const changedKeys = Array.isArray(result.changedKeys) ? result.changedKeys.slice() : [];
        changedKeys.push(
            SETTINGS_CHANGE_KEYS.PRESET_ACTIVE_ID,
            SETTINGS_CHANGE_KEYS.PRESET_ACTIVE_KIND,
            SETTINGS_CHANGE_KEYS.PRESET_STATUS
        );
        this.onSettingsChanged({ changedKeys });

        if (result.blockedPaths?.length > 0) {
            game._showStatusToast('Preset teilweise angewendet (owner-only Felder gesperrt).', 1900, 'info');
            return;
        }
        game._showStatusToast(`Preset geladen: ${presetId}`, 1300, 'success');
    }

    saveMenuPreset(event, kind) {
        const game = this.game;
        const presetName = String(event?.name || '').trim();
        const result = game.settingsManager.saveMenuPreset(
            game.settings,
            {
                kind,
                name: presetName,
                sourcePresetId: String(event?.sourcePresetId || '').trim(),
            },
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Preset konnte nicht gespeichert werden.', 1700, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [
                SETTINGS_CHANGE_KEYS.PRESET_LIST,
                SETTINGS_CHANGE_KEYS.PRESET_STATUS,
            ],
        });
        const label = kind === 'fixed' ? 'fixed' : 'open';
        game._showStatusToast(`Preset gespeichert (${label}): ${result.preset?.name || result.preset?.id}`, 1400, 'success');
    }

    deleteMenuPreset(event) {
        const game = this.game;
        const presetId = String(event?.presetId || '').trim();
        if (!presetId) {
            game._showStatusToast('Kein Preset ausgewaehlt.', 1500, 'error');
            return;
        }
        const result = game.settingsManager.deleteMenuPreset(presetId, game.settings, this._resolveMenuAccessContext());
        if (!result.success) {
            game._showStatusToast('Preset konnte nicht geloescht werden.', 1700, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [
                SETTINGS_CHANGE_KEYS.PRESET_LIST,
                SETTINGS_CHANGE_KEYS.PRESET_STATUS,
            ],
        });
        game._showStatusToast(`Preset geloescht: ${presetId}`, 1200, 'success');
    }

    _didHostChangeMatchSettings(changedKeys) {
        if (!Array.isArray(changedKeys) || changedKeys.length === 0) return false;
        return changedKeys.some((key) => MATCH_SETTING_CHANGE_KEY_SET.has(key));
    }

    _invalidateMultiplayerReadyIfHostChangedSettings(changedKeys) {
        if (!this._didHostChangeMatchSettings(changedKeys)) return;
        const accessContext = this._resolveMenuAccessContext();
        if (!accessContext.isOwner) return;

        const invalidatedEvent = this.menuMultiplayerBridge?.invalidateReadyForAll('host_settings_changed');
        if (!invalidatedEvent) return;

        this.game.ui?.multiplayerReadyToggle && (this.game.ui.multiplayerReadyToggle.checked = false);
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.MULTIPLAYER_STATUS],
        });
    }

    handleMultiplayerHost(event) {
        const game = this.game;
        const accessContext = this._resolveMenuAccessContext();
        this.menuMultiplayerBridge?.host({
            actorId: accessContext.actorId,
            lobbyCode: String(event?.lobbyCode || '').trim(),
        });
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.MULTIPLAYER_STATUS],
        });
        game._showStatusToast('Multiplayer-Host gestartet (Stub).', 1500, 'info');
    }

    handleMultiplayerJoin(event) {
        const game = this.game;
        const accessContext = this._resolveMenuAccessContext();
        this.menuMultiplayerBridge?.join({
            actorId: accessContext.actorId,
            lobbyCode: String(event?.lobbyCode || '').trim(),
        });
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.MULTIPLAYER_STATUS],
        });
        game._showStatusToast('Multiplayer-Join angefragt (Stub).', 1500, 'info');
    }

    handleMultiplayerReadyToggle(event) {
        this.menuMultiplayerBridge?.toggleReady({
            actorId: this._resolveMenuAccessContext().actorId,
            ready: !!event?.ready,
        });
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.MULTIPLAYER_STATUS],
        });
    }

    handleDeveloperModeToggle(event) {
        const game = this.game;
        const result = game.settingsManager.setDeveloperMode(
            game.settings,
            !!event?.enabled,
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Developer-Modus gesperrt.', 1500, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.DEVELOPER_MODE_ENABLED],
        });
    }

    handleDeveloperThemeChange(event) {
        const game = this.game;
        const themeId = String(event?.themeId || '').trim();
        const result = game.settingsManager.setDeveloperTheme(
            game.settings,
            themeId,
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Theme-Wechsel gesperrt.', 1500, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.DEVELOPER_THEME_ID],
        });
    }

    handleDeveloperVisibilityChange(event) {
        const game = this.game;
        const result = game.settingsManager.setDeveloperVisibility(
            game.settings,
            String(event?.mode || '').trim(),
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Developer-Visibility gesperrt.', 1500, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.DEVELOPER_VISIBILITY_MODE],
        });
    }

    handleDeveloperFixedPresetLockToggle(event) {
        const game = this.game;
        const result = game.settingsManager.setDeveloperFixedPresetLock(
            game.settings,
            !!event?.enabled,
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Fixed-Preset-Lock gesperrt.', 1500, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.DEVELOPER_FIXED_PRESET_LOCK],
        });
    }

    handleDeveloperActorChange(event) {
        const game = this.game;
        const actorId = String(event?.actorId || '').trim();
        const result = game.settingsManager.setDeveloperActor(
            game.settings,
            actorId,
            this._resolveMenuAccessContext()
        );
        if (!result.success) {
            game._showStatusToast('Actor-Wechsel gesperrt.', 1500, 'error');
            return;
        }
        this.onSettingsChanged({
            changedKeys: [SETTINGS_CHANGE_KEYS.DEVELOPER_ACTOR_ID],
        });
    }

    onSettingsChanged(event = null) {
        const game = this.game;
        const incomingChangedKeys = Array.isArray(event?.changedKeys) ? event.changedKeys : [];
        const compatibilityResult = game.settingsManager?.applyMenuCompatibilityRules?.(
            game.settings,
            { accessContext: this._resolveMenuAccessContext() }
        );
        const compatibilityKeys = Array.isArray(compatibilityResult?.changedKeys)
            ? compatibilityResult.changedKeys
            : [];
        const mergedChangedKeys = Array.from(new Set([
            ...incomingChangedKeys,
            ...compatibilityKeys,
        ]));
        const changedKeys = mergedChangedKeys.length > 0 ? mergedChangedKeys : null;

        this.markSettingsDirty(true);
        if (game.uiManager) {
            if (Array.isArray(changedKeys) && changedKeys.length > 0 && typeof game.uiManager.syncByChangeKeys === 'function') {
                game.uiManager.syncByChangeKeys(changedKeys);
            } else {
                game.uiManager.syncAll();
            }
            game.uiManager.updateContext();
        }
        if (Array.isArray(changedKeys) && changedKeys.length > 0) {
            this._invalidateMultiplayerReadyIfHostChangedSettings(changedKeys);
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

    startMatch() {
        this.game?.matchFlowUiController?.startMatch?.();
    }

    restartRound() {
        this.game?.matchFlowUiController?.startRound?.();
    }

    returnToMenu() {
        this.game?.matchFlowUiController?.returnToMenu?.();
    }

    syncP2HudVisibility() {
        const game = this.game;
        game.ui?.p2Hud?.classList?.toggle('hidden', game.numHumans !== 2);
    }
}
