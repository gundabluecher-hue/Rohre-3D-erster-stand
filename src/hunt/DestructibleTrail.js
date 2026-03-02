import { isHuntHealthActive } from './HealthSystem.js';

const DEFAULT_SELF_SKIP_RECENT = 8;

function resolveTrailDamageByProjectileType(type) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ROCKET_STRONG') return 3;
    if (normalized === 'ROCKET_MEDIUM') return 2;
    return 1;
}

export function applyTrailDamageFromProjectile(trailSpatialIndex, projectile, options = {}) {
    if (!trailSpatialIndex || !projectile || !isHuntHealthActive()) {
        return null;
    }

    const ownerIndex = Number.isInteger(projectile.owner?.index) ? projectile.owner.index : -1;
    const skipRecent = Math.max(0, Number(options.skipRecent) || DEFAULT_SELF_SKIP_RECENT);
    const hit = trailSpatialIndex.checkProjectileTrailCollision(projectile.position, projectile.radius, {
        excludePlayerIndex: ownerIndex,
        skipRecent,
    });
    if (!hit?.entry) return null;

    const damage = Math.max(1, Number(options.damage) || resolveTrailDamageByProjectileType(projectile.type));
    const damageResult = trailSpatialIndex.damageTrailSegment(hit.entry, damage);
    if (!damageResult.hit) {
        return null;
    }

    return {
        entry: hit.entry,
        closestPoint: hit.closestPoint,
        damage,
        destroyed: !!damageResult.destroyed,
        remainingHp: damageResult.remainingHp,
        maxHp: damageResult.maxHp,
    };
}
