// ============================================
// HudRuntimeSystem.js - HUD runtime orchestration
// ============================================

import { CONFIG } from '../core/Config.js';

export class HudRuntimeSystem {
    constructor(game) {
        this.game = game;
        this._hudP2Visible = null;
    }

    updateScoreHud() {
        const game = this.game;
        const humans = game.entityManager.getHumanPlayers();

        if (humans.length > 0) {
            const p1Score = String(humans[0].score);
            if (game.ui.p1Score.textContent !== p1Score) {
                game.ui.p1Score.textContent = p1Score;
            }
            this._updateItemBar(game.ui.p1Items, humans[0]);
        }

        if (humans.length > 1) {
            const p2Score = String(humans[1].score);
            if (game.ui.p2Score.textContent !== p2Score) {
                game.ui.p2Score.textContent = p2Score;
            }
            this._updateItemBar(game.ui.p2Items, humans[1]);
        }
    }

    _updateItemBar(container, player) {
        this._ensureItemSlots(container);

        for (let i = 0; i < CONFIG.POWERUP.MAX_INVENTORY; i++) {
            const slot = container.children[i];
            const type = i < player.inventory.length ? player.inventory[i] : '';

            if (slot.dataset.type === type) {
                continue;
            }

            slot.dataset.type = type;
            if (type) {
                const config = CONFIG.POWERUP.TYPES[type];
                slot.textContent = config.icon;
                slot.classList.add('active');
                slot.style.borderColor = '#' + config.color.toString(16).padStart(6, '0');
            } else {
                slot.textContent = '';
                slot.classList.remove('active');
                slot.style.borderColor = '';
            }
        }
    }

    _ensureItemSlots(container) {
        const desired = CONFIG.POWERUP.MAX_INVENTORY;

        while (container.children.length < desired) {
            const slot = document.createElement('div');
            slot.className = 'item-slot';
            slot.dataset.type = '';
            container.appendChild(slot);
        }

        while (container.children.length > desired) {
            container.removeChild(container.lastChild);
        }
    }

    _setHudP2Visibility(isVisible) {
        if (this._hudP2Visible === isVisible) return;
        this._hudP2Visible = isVisible;
        this.game.hudP2.setVisibility(isVisible);
    }

    _resolveScoreHudInterval() {
        const configuredInterval = Number(this.game?.runtimeConfig?.uiHotpath?.scoreInventoryInterval);
        if (Number.isFinite(configuredInterval) && configuredInterval > 0) {
            return configuredInterval;
        }
        return 0.2;
    }

    updatePlayingHudTick(dt) {
        const game = this.game;
        if (!game.entityManager) return;

        // Score/Inventory laufen auf eigener, konservativer Tick-Frequenz.
        const scoreHudInterval = this._resolveScoreHudInterval();
        game._hudTimer += dt;
        if (game._hudTimer >= scoreHudInterval) {
            game._hudTimer %= scoreHudInterval;
            this.updateScoreHud();
        }

        // FIGHTER HUD UPDATE
        const p1 = game.entityManager.players[0];
        if (p1) game.hudP1.update(p1, dt, game.entityManager);

        if (game.numHumans === 2) {
            this._setHudP2Visibility(true);
            const p2 = game.entityManager.players[1];
            if (p2) game.hudP2.update(p2, dt, game.entityManager);
        } else {
            this._setHudP2Visibility(false);
        }
    }
}
