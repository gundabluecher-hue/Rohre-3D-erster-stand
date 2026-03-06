export function setupMenuDevPanelBindings(ctx) {
    const ui = ctx.ui;
    const emit = ctx.emit;
    const eventTypes = ctx.eventTypes;

    const emitPresetAction = (type, extraPayload = null) => {
        const payload = extraPayload && typeof extraPayload === 'object' ? extraPayload : {};
        emit(type, payload);
    };

    if (Array.isArray(ui.quickstartPresetButtons)) {
        ui.quickstartPresetButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const presetId = String(button?.dataset?.presetId || '').trim();
                if (!presetId) return;
                emitPresetAction(eventTypes.PRESET_APPLY, {
                    presetId,
                    source: 'quickstart',
                });
            });
        });
    }

    if (ui.presetApplyButton) {
        ui.presetApplyButton.addEventListener('click', () => {
            const presetId = String(ui.presetSelect?.value || '').trim();
            if (!presetId) {
                emit(eventTypes.SHOW_STATUS_TOAST, {
                    message: 'Preset auswaehlen, bevor angewendet wird.',
                    tone: 'error',
                    duration: 1700,
                });
                return;
            }
            emitPresetAction(eventTypes.PRESET_APPLY, { presetId, source: 'custom_panel' });
        });
    }

    if (ui.presetSaveOpenButton) {
        ui.presetSaveOpenButton.addEventListener('click', () => {
            const presetName = String(ui.presetNameInput?.value || '').trim();
            emitPresetAction(eventTypes.PRESET_SAVE_OPEN, {
                name: presetName,
                sourcePresetId: String(ui.presetSelect?.value || '').trim(),
            });
        });
    }

    if (ui.presetSaveFixedButton) {
        ui.presetSaveFixedButton.addEventListener('click', () => {
            const presetName = String(ui.presetNameInput?.value || '').trim();
            emitPresetAction(eventTypes.PRESET_SAVE_FIXED, {
                name: presetName,
                sourcePresetId: String(ui.presetSelect?.value || '').trim(),
            });
        });
    }

    if (ui.presetDeleteButton) {
        ui.presetDeleteButton.addEventListener('click', () => {
            const presetId = String(ui.presetSelect?.value || '').trim();
            if (!presetId) {
                emit(eventTypes.SHOW_STATUS_TOAST, {
                    message: 'Kein Preset zum Loeschen ausgewaehlt.',
                    tone: 'error',
                    duration: 1700,
                });
                return;
            }
            emitPresetAction(eventTypes.PRESET_DELETE, { presetId });
        });
    }

    if (ui.multiplayerHostButton) {
        ui.multiplayerHostButton.addEventListener('click', () => {
            emit(eventTypes.MULTIPLAYER_HOST, {
                lobbyCode: String(ui.multiplayerLobbyCodeInput?.value || '').trim(),
            });
        });
    }

    if (ui.multiplayerJoinButton) {
        ui.multiplayerJoinButton.addEventListener('click', () => {
            emit(eventTypes.MULTIPLAYER_JOIN, {
                lobbyCode: String(ui.multiplayerLobbyCodeInput?.value || '').trim(),
            });
        });
    }

    if (ui.multiplayerReadyToggle) {
        ui.multiplayerReadyToggle.addEventListener('change', () => {
            emit(eventTypes.MULTIPLAYER_READY_TOGGLE, {
                ready: !!ui.multiplayerReadyToggle.checked,
            });
        });
    }

    if (ui.developerModeToggle) {
        ui.developerModeToggle.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_MODE_TOGGLE, {
                enabled: !!ui.developerModeToggle.checked,
            });
        });
    }

    if (ui.developerThemeSelect) {
        ui.developerThemeSelect.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_THEME_CHANGE, {
                themeId: String(ui.developerThemeSelect.value || '').trim(),
            });
        });
    }

    if (ui.developerVisibilitySelect) {
        ui.developerVisibilitySelect.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_VISIBILITY_CHANGE, {
                mode: String(ui.developerVisibilitySelect.value || '').trim(),
            });
        });
    }

    if (ui.developerFixedPresetLockToggle) {
        ui.developerFixedPresetLockToggle.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_FIXED_PRESET_LOCK_TOGGLE, {
                enabled: !!ui.developerFixedPresetLockToggle.checked,
            });
        });
    }

    if (ui.developerActorSelect) {
        ui.developerActorSelect.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_ACTOR_CHANGE, {
                actorId: String(ui.developerActorSelect.value || '').trim(),
            });
        });
    }

    if (ui.developerReleasePreviewToggle) {
        ui.developerReleasePreviewToggle.addEventListener('change', () => {
            emit(eventTypes.DEVELOPER_RELEASE_PREVIEW_TOGGLE, {
                enabled: !!ui.developerReleasePreviewToggle.checked,
            });
        });
    }

    if (ui.developerTextApplyButton) {
        ui.developerTextApplyButton.addEventListener('click', () => {
            emit(eventTypes.DEVELOPER_TEXT_OVERRIDE_SET, {
                textId: String(ui.developerTextIdSelect?.value || '').trim(),
                textValue: String(ui.developerTextOverrideInput?.value || ''),
            });
        });
    }

    if (ui.developerTextClearButton) {
        ui.developerTextClearButton.addEventListener('click', () => {
            emit(eventTypes.DEVELOPER_TEXT_OVERRIDE_CLEAR, {
                textId: String(ui.developerTextIdSelect?.value || '').trim(),
            });
        });
    }
}
