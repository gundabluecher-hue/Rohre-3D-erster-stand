// ============================================
// SpawnPlacementSystem.js - spawn and safe reposition helpers
// ============================================
//
// Contract:
// - Inputs: owner (EntityManager-like), optional isBotPositionSafe(player, position)
// - Outputs: deterministic spawn direction/position + safe bounce fallback placement
// - Side effects: mutates owner/player reusable temp vectors and player.position only
// - Hotpath guardrail: never allocate per call in update/render-adjacent paths

const DEFAULT_SAFE_BOUNCE_DISTANCES = Object.freeze([1.5, 3.0, 5.0, 0.5]);

export class SpawnPlacementSystem {
    constructor(owner, options = {}) {
        this.owner = owner || null;
        this.isBotPositionSafe = typeof options.isBotPositionSafe === 'function'
            ? options.isBotPositionSafe
            : (() => false);
    }

    findSpawnPosition(minDistance = 12, margin = 12, planarLevel = null) {
        const owner = this.owner;
        const arena = owner?.arena;
        const players = owner?.players || [];
        if (!arena) return null;

        const usePlanarLevel = Number.isFinite(planarLevel) && typeof arena.getRandomPositionOnLevel === 'function';
        const minDistanceSq = minDistance * minDistance;

        for (let attempts = 0; attempts < 100; attempts++) {
            const pos = usePlanarLevel
                ? arena.getRandomPositionOnLevel(planarLevel, margin)
                : arena.getRandomPosition(margin);
            let tooClose = false;

            for (let i = 0; i < players.length; i++) {
                const other = players[i];
                if (!other?.alive) continue;
                if (other.position.distanceToSquared(pos) < minDistanceSq) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                return pos;
            }
        }

        return usePlanarLevel
            ? arena.getRandomPositionOnLevel(planarLevel, margin)
            : arena.getRandomPosition(margin);
    }

    findSafeSpawnDirection(position, radius = 0.8) {
        const owner = this.owner;
        if (!owner) return null;

        const sampleCount = 20;
        const sampleDir = owner._tmpDir;
        const bestDirection = owner._tmpDir2;
        bestDirection.set(0, 0, -1);
        let bestDistance = -1;

        for (let i = 0; i < sampleCount; i++) {
            const angle = (Math.PI * 2 * i) / sampleCount;
            sampleDir.set(Math.sin(angle), 0, -Math.cos(angle));
            const freeDistance = this.traceFreeDistance(position, sampleDir, 36, 2.2, radius);
            if (freeDistance > bestDistance) {
                bestDistance = freeDistance;
                bestDirection.copy(sampleDir);
            }
        }

        return bestDirection;
    }

    traceFreeDistance(origin, direction, maxDistance, stepDistance, radius = 0.8) {
        const owner = this.owner;
        const arena = owner?.arena;
        if (!owner || !arena) return 0;

        const step = Math.max(0.5, stepDistance);
        let traveled = 0;
        while (traveled < maxDistance) {
            traveled += step;
            owner._tmpVec.set(
                origin.x + direction.x * traveled,
                origin.y + direction.y * traveled,
                origin.z + direction.z * traveled
            );
            if (arena.checkCollision(owner._tmpVec, radius)) {
                return traveled - step;
            }
        }
        return maxDistance;
    }

    findSafeBouncePosition(player, baseDirection, normal = null, options = {}) {
        const owner = this.owner;
        if (!owner || !player || !baseDirection) return;

        const pos = player.position;
        const distances = Array.isArray(options.distances) && options.distances.length > 0
            ? options.distances
            : DEFAULT_SAFE_BOUNCE_DISTANCES;

        for (let i = 0; i < distances.length; i++) {
            const dist = distances[i];
            owner._tmpVec2.copy(pos).addScaledVector(baseDirection, dist);
            if (this.isBotPositionSafe(player, owner._tmpVec2)) {
                pos.copy(owner._tmpVec2);
                return;
            }
        }

        if (normal) {
            const normalPush = Number.isFinite(options.normalPush) ? options.normalPush : 2.0;
            pos.addScaledVector(normal, normalPush);
            if (this.isBotPositionSafe(player, pos)) return;
        }

        const bounds = owner?.arena?.bounds;
        if (!bounds) return;
        pos.set(
            (bounds.minX + bounds.maxX) * 0.5,
            (bounds.minY + bounds.maxY) * 0.5,
            (bounds.minZ + bounds.maxZ) * 0.5
        );
    }
}
