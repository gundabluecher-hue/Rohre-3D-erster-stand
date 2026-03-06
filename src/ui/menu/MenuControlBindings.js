export function setupMenuControlBindings(ctx) {
    const ui = ctx.ui;
    const emit = ctx.emit;
    const eventTypes = ctx.eventTypes;

    ui.keybindP1.addEventListener('click', (e) => {
        const btn = e.target.closest('button.keybind-btn');
        if (!btn) return;
        emit(eventTypes.START_KEY_CAPTURE, {
            player: 'PLAYER_1',
            action: btn.dataset.action,
        });
    });

    ui.keybindP2.addEventListener('click', (e) => {
        const btn = e.target.closest('button.keybind-btn');
        if (!btn) return;
        emit(eventTypes.START_KEY_CAPTURE, {
            player: 'PLAYER_2',
            action: btn.dataset.action,
        });
    });

    if (ui.keybindGlobal) {
        ui.keybindGlobal.addEventListener('click', (e) => {
            const btn = e.target.closest('button.keybind-btn');
            if (!btn) return;
            emit(eventTypes.START_KEY_CAPTURE, {
                player: 'GLOBAL',
                action: btn.dataset.action,
            });
        });
    }

    ui.resetKeysButton.addEventListener('click', () => {
        emit(eventTypes.RESET_KEYS);
    });

    ui.saveKeysButton.addEventListener('click', () => {
        emit(eventTypes.SAVE_KEYS);
    });
}
