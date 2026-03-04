import { CONFIG } from '../../../core/Config.js';

export class PlayerInteractionPhase {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    capturePreviousPosition(player) {
        return this.entityManager._tmpPrevPlayerPosition.copy(player.position);
    }

    runSpecialGates(player, prevPos) {
        const entityManager = this.entityManager;
        const gateResult = entityManager.arena.checkSpecialGates(player.position, prevPos, player.hitboxRadius, player.index);
        if (!gateResult) return;

        if (gateResult.type === 'boost') {
            player.activateBoostPortal(gateResult.params, gateResult.forward);
            if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP');
            return;
        }

        if (gateResult.type === 'slingshot') {
            player.activateSlingshot(gateResult.params, gateResult.forward, gateResult.up);
            if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP');
        }
    }

    runPortalAndPickup(player) {
        const entityManager = this.entityManager;
        const portalResult = entityManager.arena.checkPortal(player.position, player.hitboxRadius, player.index);
        if (portalResult) {
            player.getAimDirection(entityManager._tmpDir).normalize();
            player.position.copy(portalResult.target).addScaledVector(entityManager._tmpDir, 1.8);

            if (CONFIG.GAMEPLAY.PLANAR_MODE) player.currentPlanarY = portalResult.target.y;
            player.trail.forceGap(0.5);

            if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP');
        }

        const pickedUp = entityManager.powerupManager.checkPickup(player.position, player.hitboxRadius);
        if (!pickedUp) return;

        player.addToInventory(pickedUp);
        if (entityManager.audio) entityManager.audio.play('POWERUP');
        if (entityManager.particles) entityManager.particles.spawnHit(player.position, 0x00ff00);
    }
}
