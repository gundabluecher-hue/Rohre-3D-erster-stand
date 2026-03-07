import { CONFIG } from '../../core/Config.js';
import { CUSTOM_MAP_KEY } from '../../entities/MapSchema.js';
import { GAME_MODE_TYPES, resolveActiveGameMode } from '../../hunt/HuntMode.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function setupMenuGameplayBindings(ctx) {
    const ui = ctx.ui;
    const settings = ctx.settings;
    const emit = ctx.emit;
    const emitSettingsChangedImmediate = ctx.emitSettingsChangedImmediate;
    const queueInputSettingsChanged = ctx.queueInputSettingsChanged;
    const eventTypes = ctx.eventTypes;
    const keys = ctx.settingsChangeKeys;
    const huntFeatureEnabled = CONFIG.HUNT?.ENABLED !== false;
    const applyPlanarMode = (enabled) => {
        if (!settings.gameplay) settings.gameplay = {};
        settings.gameplay.planarMode = !!enabled;
        const changedKeys = [keys.GAMEPLAY_PLANAR_MODE];

        if (settings.gameplay.planarMode && (settings.gameplay.portalCount || 0) === 0) {
            settings.gameplay.portalCount = 4;
            changedKeys.push(keys.GAMEPLAY_PORTAL_COUNT);
            emit(eventTypes.SHOW_STATUS_TOAST, {
                message: 'Ebenen-Modus: 4 Portale aktiviert',
            });
        }

        emitSettingsChangedImmediate(changedKeys);
    };

    if (Array.isArray(ui.sessionButtons)) {
        ui.sessionButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const sessionType = String(button?.dataset?.sessionType || '').trim().toLowerCase();
                if (!sessionType) return;
                emit(eventTypes.SESSION_TYPE_CHANGE, { sessionType });
            });
        });
    }

    if (Array.isArray(ui.modePathButtons)) {
        ui.modePathButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const modePath = String(button?.dataset?.modePath || '').trim().toLowerCase();
                if (!modePath) return;
                emit(eventTypes.MODE_PATH_CHANGE, { modePath });
            });
        });
    }

    if (ui.quickStartLastButton) {
        ui.quickStartLastButton.addEventListener('click', () => {
            emit(eventTypes.QUICKSTART_LAST_START);
        });
    }

    if (ui.quickStartRandomButton) {
        ui.quickStartRandomButton.addEventListener('click', () => {
            emit(eventTypes.QUICKSTART_RANDOM_START);
        });
    }

    if (Array.isArray(ui.modeButtons)) {
        ui.modeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                settings.mode = btn.dataset.mode === '2p' ? '2p' : '1p';
                emitSettingsChangedImmediate([keys.MODE]);
            });
        });
    }

    if (Array.isArray(ui.gameModeButtons)) {
        ui.gameModeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const requested = String(btn.dataset.gameMode || GAME_MODE_TYPES.CLASSIC);
                const changedKeys = [keys.GAME_MODE];
                settings.gameMode = resolveActiveGameMode(requested, huntFeatureEnabled);
                if (!settings.localSettings || typeof settings.localSettings !== 'object') {
                    settings.localSettings = {};
                }
                settings.localSettings.modePath = settings.gameMode === GAME_MODE_TYPES.HUNT ? 'fight' : 'normal';
                changedKeys.push(keys.MODE_PATH);
                if (settings.gameMode !== GAME_MODE_TYPES.HUNT) {
                    if (!settings.hunt) settings.hunt = {};
                    settings.hunt.respawnEnabled = false;
                    changedKeys.push(keys.HUNT_RESPAWN_ENABLED);
                }
                emitSettingsChangedImmediate(changedKeys);
            });
        });
    }

    if (Array.isArray(ui.dimensionModeButtons)) {
        ui.dimensionModeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const planarRaw = String(btn?.dataset?.planarMode || '').trim().toLowerCase();
                const planarEnabled = planarRaw === 'true' || planarRaw === '1' || planarRaw === 'yes';
                applyPlanarMode(planarEnabled);
            });
        });
    }

    if (ui.huntRespawnToggle) {
        ui.huntRespawnToggle.addEventListener('change', () => {
            if (!settings.hunt) settings.hunt = {};
            settings.hunt.respawnEnabled = !!ui.huntRespawnToggle.checked;
            emitSettingsChangedImmediate([keys.HUNT_RESPAWN_ENABLED]);
        });
    }

    if (ui.vehicleSelectP1) {
        ui.vehicleSelectP1.addEventListener('change', (e) => {
            settings.vehicles.PLAYER_1 = e.target.value;
            emitSettingsChangedImmediate([keys.VEHICLES_PLAYER_1]);
        });
    }
    if (ui.vehicleSelectP2) {
        ui.vehicleSelectP2.addEventListener('change', (e) => {
            settings.vehicles.PLAYER_2 = e.target.value;
            emitSettingsChangedImmediate([keys.VEHICLES_PLAYER_2]);
        });
    }

    ui.mapSelect.addEventListener('change', (e) => {
        const selectedMapKey = String(e.target.value || '');
        settings.mapKey = (selectedMapKey === CUSTOM_MAP_KEY || CONFIG.MAPS[selectedMapKey])
            ? selectedMapKey
            : 'standard';
        emitSettingsChangedImmediate([keys.MAP_KEY]);
    });

    if (ui.themeModeSelect) {
        ui.themeModeSelect.addEventListener('change', () => {
            if (!settings.localSettings || typeof settings.localSettings !== 'object') {
                settings.localSettings = {};
            }
            settings.localSettings.themeMode = ui.themeModeSelect.value === 'hell' ? 'hell' : 'dunkel';
            emitSettingsChangedImmediate([keys.LOCAL_THEME_MODE]);
        });
    }

    ui.botSlider.addEventListener('input', () => {
        settings.numBots = clamp(parseInt(ui.botSlider.value, 10), 0, 8);
        queueInputSettingsChanged([keys.BOTS_COUNT]);
    });

    if (ui.botDifficultySelect) {
        ui.botDifficultySelect.addEventListener('change', () => {
            const value = String(ui.botDifficultySelect.value || '').toUpperCase();
            settings.botDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(value) ? value : 'NORMAL';
            emitSettingsChangedImmediate([keys.BOTS_DIFFICULTY]);
        });
    }

    ui.winSlider.addEventListener('input', () => {
        settings.winsNeeded = clamp(parseInt(ui.winSlider.value, 10), 1, 15);
        queueInputSettingsChanged([keys.RULES_WINS_NEEDED]);
    });

    ui.autoRollToggle.addEventListener('change', () => {
        settings.autoRoll = !!ui.autoRollToggle.checked;
        emitSettingsChangedImmediate([keys.RULES_AUTO_ROLL]);
    });

    ui.invertP1.addEventListener('change', () => {
        settings.invertPitch.PLAYER_1 = !!ui.invertP1.checked;
        emitSettingsChangedImmediate([keys.RULES_INVERT_P1]);
    });

    ui.invertP2.addEventListener('change', () => {
        settings.invertPitch.PLAYER_2 = !!ui.invertP2.checked;
        emitSettingsChangedImmediate([keys.RULES_INVERT_P2]);
    });

    ui.cockpitCamP1.addEventListener('change', () => {
        settings.cockpitCamera.PLAYER_1 = !!ui.cockpitCamP1.checked;
        emitSettingsChangedImmediate([keys.RULES_COCKPIT_P1]);
    });

    ui.cockpitCamP2.addEventListener('change', () => {
        settings.cockpitCamera.PLAYER_2 = !!ui.cockpitCamP2.checked;
        emitSettingsChangedImmediate([keys.RULES_COCKPIT_P2]);
    });

    const planarModeToggle = document.getElementById('planar-mode-toggle');
    if (planarModeToggle) {
        planarModeToggle.addEventListener('change', (e) => {
            applyPlanarMode(!!e.target.checked);
        });
    }

    ui.portalsToggle.addEventListener('change', () => {
        settings.portalsEnabled = !!ui.portalsToggle.checked;
        emitSettingsChangedImmediate([keys.RULES_PORTALS_ENABLED]);
    });

    ui.speedSlider.addEventListener('input', () => {
        settings.gameplay.speed = clamp(parseFloat(ui.speedSlider.value), 8, 40);
        queueInputSettingsChanged([keys.GAMEPLAY_SPEED]);
    });

    ui.turnSlider.addEventListener('input', () => {
        settings.gameplay.turnSensitivity = clamp(parseFloat(ui.turnSlider.value), 0.8, 5);
        queueInputSettingsChanged([keys.GAMEPLAY_TURN_SENSITIVITY]);
    });

    ui.planeSizeSlider.addEventListener('input', () => {
        settings.gameplay.planeScale = clamp(parseFloat(ui.planeSizeSlider.value), 0.6, 2.0);
        queueInputSettingsChanged([keys.GAMEPLAY_PLANE_SCALE]);
    });

    ui.trailWidthSlider.addEventListener('input', () => {
        settings.gameplay.trailWidth = clamp(parseFloat(ui.trailWidthSlider.value), 0.2, 2.5);
        queueInputSettingsChanged([keys.GAMEPLAY_TRAIL_WIDTH]);
    });

    ui.gapSizeSlider.addEventListener('input', () => {
        settings.gameplay.gapSize = clamp(parseFloat(ui.gapSizeSlider.value), 0.05, 1.5);
        queueInputSettingsChanged([keys.GAMEPLAY_GAP_SIZE]);
    });

    ui.gapFrequencySlider.addEventListener('input', () => {
        settings.gameplay.gapFrequency = clamp(parseFloat(ui.gapFrequencySlider.value), 0, 0.25);
        queueInputSettingsChanged([keys.GAMEPLAY_GAP_FREQUENCY]);
    });

    ui.itemAmountSlider.addEventListener('input', () => {
        settings.gameplay.itemAmount = clamp(parseInt(ui.itemAmountSlider.value, 10), 1, 20);
        queueInputSettingsChanged([keys.GAMEPLAY_ITEM_AMOUNT]);
    });

    ui.fireRateSlider.addEventListener('input', () => {
        settings.gameplay.fireRate = clamp(parseFloat(ui.fireRateSlider.value), 0.1, 2.0);
        queueInputSettingsChanged([keys.GAMEPLAY_FIRE_RATE]);
    });

    ui.lockOnSlider.addEventListener('input', () => {
        settings.gameplay.lockOnAngle = clamp(parseInt(ui.lockOnSlider.value, 10), 5, 45);
        queueInputSettingsChanged([keys.GAMEPLAY_LOCK_ON_ANGLE]);
    });

    if (ui.mgTrailAimSlider) {
        ui.mgTrailAimSlider.addEventListener('input', () => {
            settings.gameplay.mgTrailAimRadius = clamp(parseFloat(ui.mgTrailAimSlider.value), 0.2, 3.0);
            queueInputSettingsChanged([keys.GAMEPLAY_MG_TRAIL_AIM_RADIUS]);
        });
    }

    ui.startButton.addEventListener('click', () => {
        emit(eventTypes.START_MATCH);
    });

    if (ui.level3ResetButton) {
        ui.level3ResetButton.addEventListener('click', () => {
            emit(eventTypes.LEVEL3_RESET);
        });
    }

    if (ui.openLevel4Button) {
        ui.openLevel4Button.addEventListener('click', () => {
            emit(eventTypes.LEVEL4_OPEN, {
                sectionId: String(ui.openLevel4Button?.dataset?.level4Section || '').trim(),
            });
        });
    }

    const legacyLevel4OpenButtons = Array.from(document.querySelectorAll('[data-menu-action="level4-open"]'));
    legacyLevel4OpenButtons.forEach((button) => {
        button.addEventListener('click', () => {
            emit(eventTypes.LEVEL4_OPEN, {
                sectionId: String(button?.dataset?.level4Section || '').trim(),
            });
        });
    });

    if (ui.closeLevel4Button) {
        ui.closeLevel4Button.addEventListener('click', () => {
            emit(eventTypes.LEVEL4_CLOSE);
        });
    }

    if (ui.level4ResetButton) {
        ui.level4ResetButton.addEventListener('click', () => {
            emit(eventTypes.LEVEL4_RESET);
        });
    }

    if (ui.exportConfigCodeButton) {
        ui.exportConfigCodeButton.addEventListener('click', () => {
            emit(eventTypes.CONFIG_EXPORT_CODE);
        });
    }

    if (ui.exportConfigJsonButton) {
        ui.exportConfigJsonButton.addEventListener('click', () => {
            emit(eventTypes.CONFIG_EXPORT_JSON);
        });
    }

    if (ui.importConfigButton) {
        ui.importConfigButton.addEventListener('click', () => {
            emit(eventTypes.CONFIG_IMPORT, {
                inputValue: String(ui.configShareInput?.value || ''),
            });
        });
    }

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

    const portalCountSlider = document.getElementById('portal-count-slider');
    const portalCountLabel = document.getElementById('portal-count-label');
    if (portalCountSlider && portalCountLabel) {
        portalCountSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            portalCountLabel.textContent = val;
            if (!settings.gameplay) settings.gameplay = {};
            settings.gameplay.portalCount = val;
            queueInputSettingsChanged([keys.GAMEPLAY_PORTAL_COUNT]);
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
            queueInputSettingsChanged([keys.GAMEPLAY_PLANAR_LEVEL_COUNT]);
        });
    }
}
