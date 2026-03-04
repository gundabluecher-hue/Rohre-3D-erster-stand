// ============================================
// HuntCombatSystem.js - inventory/projectile/lock-on combat helpers
// ============================================
//
// Contract:
// - Inputs: owner (EntityManager-like runtime with players/cache/systems)
// - Outputs: command results for inventory use, gun fire, lock-on target
// - Side effects: mutates player inventory/selection and owner lock-on cache
// - Hotpath guardrail: reuse owner temp vectors and avoid per-call allocations

import { CONFIG } from '../../core/Config.js';

export class HuntCombatSystem {
    constructor(owner) {
        this.owner = owner || null;
    }

    takeInventoryItem(player, preferredIndex = -1) {
        if (!player.inventory || player.inventory.length === 0) {
            return { ok: false, reason: 'Kein Item verfuegbar', type: null };
        }
        const index = Number.isInteger(preferredIndex) && preferredIndex >= 0
            ? Math.min(preferredIndex, player.inventory.length - 1)
            : Math.min(player.selectedItemIndex || 0, player.inventory.length - 1);
        const type = player.inventory.splice(index, 1)[0];
        if (player.inventory.length === 0 || player.selectedItemIndex >= player.inventory.length) {
            player.selectedItemIndex = 0;
        }
        return { ok: true, type };
    }

    useInventoryItem(player, preferredIndex = -1) {
        const itemResult = this.takeInventoryItem(player, preferredIndex);
        if (!itemResult.ok) return { ok: false, reason: itemResult.reason };
        player.applyPowerup(itemResult.type);
        return { ok: true, type: itemResult.type };
    }

    shootItemProjectile(player, preferredIndex = -1) {
        return this.owner?._projectileSystem?.shootItemProjectile(player, preferredIndex)
            || { ok: false, reason: 'ProjectileSystem fehlt' };
    }

    shootHuntGun(player) {
        return this.owner?._overheatGunSystem?.tryFire(player)
            || { ok: false, reason: 'OverheatGunSystem fehlt' };
    }

    checkLockOn(player) {
        const owner = this.owner;
        if (!owner || !player) return null;
        if (owner._lockOnCache.has(player.index)) return owner._lockOnCache.get(player.index);

        player.getDirection(owner._tmpDir).normalize();
        const maxAngle = (CONFIG.HOMING.LOCK_ON_ANGLE * Math.PI) / 180;
        const maxRangeSq = CONFIG.HOMING.MAX_LOCK_RANGE * CONFIG.HOMING.MAX_LOCK_RANGE;
        let bestTarget = null;
        let bestDistSq = Infinity;

        for (let i = 0; i < owner.players.length; i++) {
            const other = owner.players[i];
            if (other === player || !other?.alive) continue;
            owner._tmpVec.subVectors(other.position, player.position);
            const distSq = owner._tmpVec.lengthSq();
            if (distSq > maxRangeSq || distSq < 1) continue;
            const angle = owner._tmpDir.angleTo(owner._tmpVec.normalize());
            if (angle <= maxAngle && distSq < bestDistSq) {
                bestTarget = other;
                bestDistSq = distSq;
            }
        }

        owner._lockOnCache.set(player.index, bestTarget);
        return bestTarget;
    }
}
