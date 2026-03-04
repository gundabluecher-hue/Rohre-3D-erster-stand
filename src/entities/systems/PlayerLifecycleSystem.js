// ============================================
// PlayerLifecycleSystem.js - player tick and lifecycle updates
// ============================================

import { isHuntHealthActive } from '../../hunt/HealthSystem.js';
import { PlayerActionPhase } from './lifecycle/PlayerActionPhase.js';
import { PlayerCollisionPhase } from './lifecycle/PlayerCollisionPhase.js';
import { PlayerInteractionPhase } from './lifecycle/PlayerInteractionPhase.js';

export class PlayerLifecycleSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this._actionPhase = new PlayerActionPhase(entityManager);
        this._collisionPhase = new PlayerCollisionPhase(entityManager);
        this._interactionPhase = new PlayerInteractionPhase(entityManager);
    }

    updateShootCooldown(player, dt) {
        player.shootCooldown = Math.max(0, (player.shootCooldown || 0) - dt);
    }

    updatePlayer(player, dt, input) {
        const huntModeActive = isHuntHealthActive();
        this._actionPhase.run(player, input, huntModeActive);

        const prevPos = this._interactionPhase.capturePreviousPosition(player);
        player.update(dt, input);

        this._interactionPhase.runSpecialGates(player, prevPos);
        const aborted = this._collisionPhase.run(player, prevPos, huntModeActive);
        if (aborted || !player.alive) return;

        this._interactionPhase.runPortalAndPickup(player);
    }
}

