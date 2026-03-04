import { CONFIG } from '../../../core/Config.js';

export class PortalRuntimeSystem {
    constructor(arena) {
        this.arena = arena;
    }

    checkPortal(position, radius, entityId) {
        if (!this.arena.portalsEnabled) return null;

        const triggerRadius = CONFIG.PORTAL.RADIUS;
        const triggerRadiusSq = (triggerRadius + radius) * (triggerRadius + radius);

        for (const portal of this.arena.portals) {
            if (portal.cooldowns.has(entityId) && portal.cooldowns.get(entityId) > 0) continue;

            const distASq = position.distanceToSquared(portal.posA);
            const distBSq = position.distanceToSquared(portal.posB);

            if (distASq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.min(2.5, Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80));
                portal.cooldowns.set(entityId, dynamicCooldown);
                console.log(`[Arena] PORTAL HIT: Entity ${entityId} teleporting A -> B (Cooldown: ${dynamicCooldown.toFixed(1)}s)`);
                return { target: portal.posB, portal };
            }
            if (distBSq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.min(2.5, Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80));
                portal.cooldowns.set(entityId, dynamicCooldown);
                console.log(`[Arena] PORTAL HIT: Entity ${entityId} teleporting B -> A (Cooldown: ${dynamicCooldown.toFixed(1)}s)`);
                return { target: portal.posA, portal };
            }
        }

        return null;
    }

    update(dt) {
        for (const portal of this.arena.portals) {
            for (const [id, t] of portal.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    portal.cooldowns.delete(id);
                } else {
                    portal.cooldowns.set(id, newT);
                }
            }
        }

        const time = performance.now() * 0.001;
        for (const portal of this.arena.portals) {
            if (portal.meshA) portal.meshA.rotation.z = time * 0.5;
            if (portal.meshB) portal.meshB.rotation.z = -time * 0.5;
        }
    }
}
