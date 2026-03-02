// ============================================
// state_serializer.mjs - Extract observation vector from game state
// ~180 dimensions matching AGENT_PROMPT.md spec
// ============================================

import * as THREE from 'three';

const _tmpVec = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _tmpRel = new THREE.Vector3();

// ---------- SELF STATE (18) ----------
function extractSelfState(player) {
    const dir = player.getDirection(_tmpDir);
    const right = _tmpVec.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = _tmpVec.crossVectors(right, dir).normalize();

    const effects = [0, 0, 0, 0]; // speed, shield, ghost, invert
    for (const e of player.activeEffects) {
        if (e.type === 'SPEED_UP' || e.type === 'SLOW_DOWN') effects[0] = e.remaining;
        if (e.type === 'SHIELD') effects[1] = e.remaining;
        if (e.type === 'GHOST') effects[2] = e.remaining;
        if (e.type === 'INVERT') effects[3] = e.remaining;
    }

    return [
        player.position.x, player.position.y, player.position.z,
        dir.x, dir.y, dir.z,
        right.x, right.y, right.z,
        player.speed,
        player.alive ? 1 : 0,
        player.isBoosting ? 1 : 0,
        effects[0], effects[1], effects[2], effects[3],
        player.hitboxRadius,
        player.boostCooldown > 0 ? 1 : 0,
    ];
}

// ---------- ENEMY SLOTS (5×14 = 70) ----------
function extractEnemySlots(player, allPlayers, maxSlots = 5) {
    const slots = [];
    const enemies = allPlayers
        .filter(p => p !== player)
        .sort((a, b) => {
            const dA = player.position.distanceToSquared(a.position);
            const dB = player.position.distanceToSquared(b.position);
            return dA - dB;
        });

    const myDir = player.getDirection(_tmpDir);

    for (let i = 0; i < maxSlots; i++) {
        if (i < enemies.length && enemies[i].alive) {
            const e = enemies[i];
            _tmpRel.subVectors(e.position, player.position);
            const dist = _tmpRel.length();
            const relDir = _tmpRel.clone().normalize();
            const eDir = e.getDirection(_tmpVec);
            const angle = myDir.angleTo(relDir);

            const eEffects = [0, 0, 0];
            for (const eff of e.activeEffects) {
                if (eff.type === 'SPEED_UP' || eff.type === 'SLOW_DOWN') eEffects[0] = 1;
                if (eff.type === 'SHIELD') eEffects[1] = 1;
                if (eff.type === 'GHOST') eEffects[2] = 1;
            }

            slots.push(
                relDir.x, relDir.y, relDir.z,
                eDir.x, eDir.y, eDir.z,
                e.speed,
                e.alive ? 1 : 0,
                dist,
                angle,
                e.isBoosting ? 1 : 0,
                eEffects[0], eEffects[1], eEffects[2],
            );
        } else {
            // Empty slot
            slots.push(0, 0, 0, 0, 0, 0, 0, 0, 999, Math.PI, 0, 0, 0, 0);
        }
    }
    return slots;
}

// ---------- PROBE RAYS (12×3 = 36) ----------
function extractProbeRays(player, arena) {
    const rays = [];
    const probeAngles = [];
    for (let i = 0; i < 12; i++) {
        const yaw = ((i / 12) * 2 - 1) * Math.PI * 0.8;
        const pitch = 0;
        probeAngles.push({ yaw, pitch });
    }

    const fwd = player.getDirection(_tmpDir);
    const right = _tmpVec.set(0, 1, 0).cross(fwd).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);

    for (const probe of probeAngles) {
        const dir = new THREE.Vector3()
            .addScaledVector(fwd, Math.cos(probe.yaw))
            .addScaledVector(right, Math.sin(probe.yaw))
            .normalize();

        let wallDist = 1.0; // normalized
        let trailDist = 1.0;
        let danger = 0;

        const maxDist = 20;
        const step = 1.5;
        const pos = new THREE.Vector3();

        for (let d = step; d <= maxDist; d += step) {
            pos.copy(player.position).addScaledVector(dir, d);
            if (arena.checkCollisionFast
                ? arena.checkCollisionFast(pos, 0.4)
                : arena.checkCollision(pos, 0.4)) {
                wallDist = d / maxDist;
                danger = 1 - wallDist;
                break;
            }
        }

        rays.push(wallDist, trailDist, danger);
    }
    return rays;
}

// ---------- INVENTORY (5×2 = 10) ----------
function extractInventory(player, maxSlots = 5) {
    const inv = [];
    const typeMap = {
        SPEED_UP: 1, SLOW_DOWN: 2, THICK: 3, THIN: 4,
        SHIELD: 5, SLOW_TIME: 6, GHOST: 7, INVERT: 8,
    };
    for (let i = 0; i < maxSlots; i++) {
        if (i < player.inventory.length) {
            inv.push(typeMap[player.inventory[i]] || 0, 1);
        } else {
            inv.push(0, 0);
        }
    }
    return inv;
}

// ---------- PROJECTILES (3×6 = 18) ----------
function extractProjectiles(player, projectiles, maxSlots = 3) {
    const proj = [];
    const sorted = projectiles
        .filter(p => p.owner !== player)
        .sort((a, b) => {
            const dA = player.position.distanceToSquared(a.position);
            const dB = player.position.distanceToSquared(b.position);
            return dA - dB;
        });

    for (let i = 0; i < maxSlots; i++) {
        if (i < sorted.length) {
            const p = sorted[i];
            _tmpRel.subVectors(p.position, player.position);
            proj.push(
                _tmpRel.x, _tmpRel.y, _tmpRel.z,
                p.velocity.x, p.velocity.y, p.velocity.z,
            );
        } else {
            proj.push(0, 0, 0, 0, 0, 0);
        }
    }
    return proj;
}

// ---------- POWERUPS (4×4 = 16) ----------
function extractPowerups(player, powerups, maxSlots = 4) {
    const items = [];
    const typeMap = {
        SPEED_UP: 1, SLOW_DOWN: 2, THICK: 3, THIN: 4,
        SHIELD: 5, SLOW_TIME: 6, GHOST: 7, INVERT: 8,
    };

    const sorted = powerups
        .sort((a, b) => {
            const dA = player.position.distanceToSquared(a.mesh.position);
            const dB = player.position.distanceToSquared(b.mesh.position);
            return dA - dB;
        });

    for (let i = 0; i < maxSlots; i++) {
        if (i < sorted.length) {
            const it = sorted[i];
            _tmpRel.subVectors(it.mesh.position, player.position);
            items.push(
                _tmpRel.x, _tmpRel.y, _tmpRel.z,
                typeMap[it.type] || 0
            );
        } else {
            items.push(0, 0, 0, 0);
        }
    }
    return items;
}

// ---------- ARENA CONTEXT (8) ----------
function extractArenaContext(player, arena, allPlayers, gameTime, config) {
    const bounds = arena.bounds || { minX: -40, maxX: 40, minY: 0, maxY: 30, minZ: -40, maxZ: 40 };
    const sizeX = bounds.maxX - bounds.minX;
    const sizeY = bounds.maxY - bounds.minY;
    const sizeZ = bounds.maxZ - bounds.minZ;
    const planar = config.GAMEPLAY?.PLANAR_MODE ? 1 : 0;
    const alive = allPlayers.filter(p => p.alive).length;

    // Nearest portal distance
    let portalDist = 999;
    if (Array.isArray(arena.portals)) {
        for (const portal of arena.portals) {
            if (portal.posA) {
                const d = player.position.distanceTo(portal.posA);
                portalDist = Math.min(portalDist, d);
            }
            if (portal.posB) {
                const d = player.position.distanceTo(portal.posB);
                portalDist = Math.min(portalDist, d);
            }
        }
    }

    return [sizeX, sizeY, sizeZ, planar, alive, gameTime, portalDist / 100, 0];
}

// ---------- GAME MODE (4) ----------
function extractGameMode(config, allPlayers, gameTime, maxTime = 180) {
    const planar = config.GAMEPLAY?.PLANAR_MODE ? 1 : 0;
    const totalPlayers = allPlayers.length;
    const roundProgress = Math.min(1, gameTime / maxTime);
    return [planar, totalPlayers, roundProgress, 0];
}

// ---------- COMBINED EXTRACTOR ----------
export function serializeState(player, allPlayers, arena, projectiles, powerups, gameTime, config) {
    const obs = [
        ...extractSelfState(player),           // 18
        ...extractEnemySlots(player, allPlayers), // 70
        ...extractProbeRays(player, arena),    // 36
        ...extractInventory(player),           // 10
        ...extractProjectiles(player, projectiles), // 18
        ...extractPowerups(player, powerups || []), // 16
        ...extractArenaContext(player, arena, allPlayers, gameTime, config), // 8
        ...extractGameMode(config, allPlayers, gameTime), // 4
    ];
    // Total: 18+70+36+10+18+16+8+4 = 180
    while (obs.length < 180) obs.push(0);
    return obs.slice(0, 180);
}

export function getObservationSize() {
    return 180;
}
