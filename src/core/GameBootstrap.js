import { Renderer } from './Renderer.js';
import { GameLoop } from './GameLoop.js';
import { InputManager } from './InputManager.js';
import { ParticleSystem } from '../entities/Particles.js';
import { AudioManager } from './Audio.js';
import { HUD } from '../ui/HUD.js';
import { MatchFlowUiController } from '../ui/MatchFlowUiController.js';
import { RuntimeDiagnosticsSystem } from './RuntimeDiagnosticsSystem.js';
import { KeybindEditorController } from '../ui/KeybindEditorController.js';
import { HuntHUD } from '../hunt/HuntHUD.js';
import { ScreenShake } from '../hunt/ScreenShake.js';
import { PlanarAimAssistSystem } from './PlanarAimAssistSystem.js';
import { MatchSessionRuntimeBridge } from './MatchSessionRuntimeBridge.js';
import { HudRuntimeSystem } from '../ui/HudRuntimeSystem.js';
import { CrosshairSystem } from '../ui/CrosshairSystem.js';
import { BuildInfoController } from './BuildInfoController.js';

export function createGameUiRefs() {
    return {
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
        mgTrailAimSlider: document.getElementById('mg-trail-aim-slider'),
        mgTrailAimLabel: document.getElementById('mg-trail-aim-label'),
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
}

export function bootstrapGameRuntime(game, options = {}) {
    const canvas = document.getElementById('game-canvas');
    game.renderer = new Renderer(canvas);
    game.input = new InputManager();
    game.audio = new AudioManager();
    game.particles = new ParticleSystem(game.renderer);

    game.hudP1 = new HUD('p1-fighter-hud', 0);
    game.hudP2 = new HUD('p2-fighter-hud', 1);
    game.huntHud = new HuntHUD(game);
    game.screenShake = new ScreenShake(game.renderer);
    game.hudRuntimeSystem = new HudRuntimeSystem(game);
    game.crosshairSystem = new CrosshairSystem(game);
    game.matchFlowUiController = new MatchFlowUiController(game);
    game.runtimeDiagnosticsSystem = new RuntimeDiagnosticsSystem(game);
    game.keybindEditorController = new KeybindEditorController(game);
    game.planarAimAssistSystem = new PlanarAimAssistSystem(game);
    game.matchSessionRuntimeBridge = new MatchSessionRuntimeBridge(game);

    game.gameLoop = new GameLoop(
        (dt) => game.update(dt),
        () => game.render()
    );

    game.ui = createGameUiRefs();
    game._navButtons = [];
    game._menuButtonByPanel = new Map();
    game._activeSubmenu = null;
    game._lastMenuTrigger = null;
    game._buildInfoClipboardText = '';

    const showStatusToast = typeof options.showStatusToast === 'function'
        ? options.showStatusToast
        : (message, durationMs, tone) => game?._showStatusToast?.(message, durationMs, tone);

    game.buildInfoController = new BuildInfoController({
        ui: game.ui,
        showStatusToast,
        appVersion: options.appVersion,
        buildId: options.buildId,
        buildTime: options.buildTime,
    });
}
