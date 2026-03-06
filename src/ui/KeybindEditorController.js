import { GLOBAL_KEY_BIND_ACTIONS, KEY_BIND_ACTIONS } from '../core/SettingsManager.js';

export class KeybindEditorController {
    constructor(game) {
        this.game = game;
    }

    renderEditor() {
        const game = this.game;
        const conflicts = this.collectKeyConflicts();
        this.renderKeybindRows('PLAYER_1', game.ui.keybindP1, KEY_BIND_ACTIONS, conflicts);
        this.renderKeybindRows('PLAYER_2', game.ui.keybindP2, KEY_BIND_ACTIONS, conflicts);
        this.renderKeybindRows('GLOBAL', game.ui.keybindGlobal, GLOBAL_KEY_BIND_ACTIONS, conflicts);
        this.updateKeyConflictWarning(conflicts);
    }

    renderKeybindRows(playerKey, container, actions, conflicts) {
        if (!container) return;

        const game = this.game;
        container.innerHTML = '';

        for (const action of actions) {
            const row = document.createElement('div');
            row.className = 'key-row';

            const label = document.createElement('div');
            label.className = 'key-action';
            label.textContent = action.label;

            const value = this.getControlValue(playerKey, action.key);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'keybind-btn';
            button.dataset.action = action.key;
            const isConflict = !!value && (conflicts.get(value) || 0) > 1;
            button.textContent = this.formatKeyCode(value) + (isConflict ? '  (Konflikt)' : '');
            if (isConflict) {
                row.classList.add('conflict');
                button.classList.add('conflict');
            }

            if (game.keyCapture && game.keyCapture.playerKey === playerKey && game.keyCapture.actionKey === action.key) {
                button.classList.add('listening');
                button.textContent = 'Taste druecken...';
            }

            row.appendChild(label);
            row.appendChild(button);
            container.appendChild(row);
        }
    }

    startKeyCapture(playerKey, actionKey) {
        this.game.keyCapture = { playerKey, actionKey };
        this.renderEditor();
    }

    handleKeyCapture(event) {
        const game = this.game;
        if (!game.keyCapture || game.ui.mainMenu.classList.contains('hidden')) {
            return false;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.code === 'Escape') {
            game.keyCapture = null;
            this.renderEditor();
            return true;
        }

        this.setControlValue(game.keyCapture.playerKey, game.keyCapture.actionKey, event.code);
        game.keyCapture = null;
        game._onSettingsChanged();
        game._showStatusToast('✅ Taste gespeichert!');
        return true;
    }

    getControlValue(playerKey, actionKey) {
        const controls = this.game.settings?.controls || {};
        const playerControls = controls[playerKey] || {};
        return playerControls[actionKey] || '';
    }

    setControlValue(playerKey, actionKey, value) {
        if (!this.game.settings.controls[playerKey]) {
            this.game.settings.controls[playerKey] = {};
        }
        this.game.settings.controls[playerKey][actionKey] = value;
    }

    collectKeyConflicts() {
        const counts = new Map();
        const scopes = [
            { key: 'PLAYER_1', actions: KEY_BIND_ACTIONS },
            { key: 'PLAYER_2', actions: KEY_BIND_ACTIONS },
            { key: 'GLOBAL', actions: GLOBAL_KEY_BIND_ACTIONS },
        ];
        for (const scope of scopes) {
            for (const action of scope.actions) {
                const code = this.getControlValue(scope.key, action.key);
                if (!code) continue;
                counts.set(code, (counts.get(code) || 0) + 1);
            }
        }
        return counts;
    }

    updateKeyConflictWarning(conflicts) {
        const warning = this.game.ui.keybindWarning;
        if (!warning) return;

        const conflictCodes = Array.from(conflicts.entries())
            .filter(([, count]) => count > 1)
            .map(([code]) => this.formatKeyCode(code));

        if (conflictCodes.length === 0) {
            warning.classList.add('hidden');
            warning.textContent = '';
            return;
        }

        warning.classList.remove('hidden');
        warning.textContent = `Achtung: Mehrfachbelegte Tasten: ${conflictCodes.join(', ')}`;
    }

    formatKeyCode(code) {
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

        if (named[code]) return named[code];
        if (code.startsWith('Key')) return code.slice(3);
        if (code.startsWith('Digit')) return code.slice(5);
        if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
        return code;
    }
}
