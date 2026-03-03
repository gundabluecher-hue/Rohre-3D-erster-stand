// ============================================
// ObservationSystem.js - centralized runtime observation extraction
// ============================================

import * as THREE from 'three';
import {
    BOOST_ACTIVE,
    CONTEXT_RESERVED,
    HEALTH_RATIO,
    INVENTORY_COUNT_RATIO,
    ITEM_SLOT_00,
    LOCAL_OPENNESS_RATIO,
    MODE_ID,
    OBSERVATION_LENGTH_V1,
    PLANAR_MODE_ACTIVE,
    PRESSURE_LEVEL,
    PROJECTILE_THREAT,
    SELECTED_ITEM_SLOT,
    SHIELD_RATIO,
    SPEED_RATIO,
    TARGET_ALIGNMENT,
    TARGET_DISTANCE_RATIO,
    TARGET_IN_FRONT,
    WALL_DISTANCE_DOWN,
    WALL_DISTANCE_FRONT,
    WALL_DISTANCE_LEFT,
    WALL_DISTANCE_RIGHT,
    WALL_DISTANCE_UP,
} from './ObservationSchemaV1.js';
import {
    clamp,
    clamp01,
    normalizeDistanceRatio,
    normalizeHealthRatio,
    normalizeShieldRatio,
    normalizeSigned,
    normalizeSpeedRatio,
    normalizeRatio,
    toBinaryFlag,
} from './ObservationNormalizeOps.js';
import { encodeItemSlots, ITEM_SLOT_COUNT } from './ItemSlotEncoder.js';
import { encodeModeId } from './ModeFeatureEncoder.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TMP_FORWARD = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_UP = new THREE.Vector3();
const TMP_LEFT = new THREE.Vector3();
const TMP_DOWN = new THREE.Vector3();
const TMP_TO_TARGET = new THREE.Vector3();
const TMP_DIRECTION = new THREE.Vector3();
const TMP_PROBE = new THREE.Vector3();

const DEFAULT_CONTEXT = Object.freeze({
    arena: null,
    players: [],
    projectiles: [],
    mode: 'classic',
    planarMode: false,
    wallProbeDistance: 45,
    targetDistanceMax: 120,
    projectileThreatRange: 28,
});

function resetObservationTarget(target) {
    for (let i = 0; i < OBSERVATION_LENGTH_V1; i++) {
        target[i] = 0;
    }
    return target;
}

function getObservationTarget(target) {
    if (target && typeof target.length === 'number' && typeof target.fill === 'function') {
        return resetObservationTarget(target);
    }
    return new Array(OBSERVATION_LENGTH_V1).fill(0);
}

function buildBasisFromPlayer(player) {
    player.getDirection(TMP_FORWARD).normalize();
    TMP_RIGHT.crossVectors(WORLD_UP, TMP_FORWARD);
    if (TMP_RIGHT.lengthSq() <= 0.000001) {
        TMP_RIGHT.set(1, 0, 0);
    } else {
        TMP_RIGHT.normalize();
    }
    TMP_UP.crossVectors(TMP_FORWARD, TMP_RIGHT).normalize();
}

function sampleWallDistanceRatio(arena, origin, direction, radius, maxDistance, steps = 20) {
    if (!arena || typeof arena.checkCollision !== 'function') {
        return 1;
    }

    const safeSteps = Math.max(4, Math.trunc(steps));
    const safeMaxDistance = Math.max(1, Number(maxDistance) || 1);
    const stepDistance = safeMaxDistance / safeSteps;

    for (let i = 1; i <= safeSteps; i++) {
        TMP_PROBE.copy(origin).addScaledVector(direction, stepDistance * i);
        if (arena.checkCollision(TMP_PROBE, radius)) {
            return normalizeDistanceRatio(stepDistance * (i - 1), safeMaxDistance, 0);
        }
    }

    return 1;
}

function findNearestEnemy(player, players) {
    let nearest = null;
    let nearestDistSq = Infinity;

    for (let i = 0; i < players.length; i++) {
        const other = players[i];
        if (!other || other === player || !other.alive) continue;
        TMP_TO_TARGET.subVectors(other.position, player.position);
        const distSq = TMP_TO_TARGET.lengthSq();
        if (distSq < nearestDistSq) {
            nearest = other;
            nearestDistSq = distSq;
        }
    }

    if (!nearest) {
        return { nearest: null, distance: Infinity, alignment: 0 };
    }

    TMP_TO_TARGET.subVectors(nearest.position, player.position).normalize();
    const alignment = TMP_FORWARD.dot(TMP_TO_TARGET);
    return {
        nearest,
        distance: Math.sqrt(nearestDistSq),
        alignment,
    };
}

function computeProjectileThreat(player, projectiles, threatRange) {
    if (!Array.isArray(projectiles) || projectiles.length === 0) {
        return 0;
    }

    const maxDistSq = Math.max(1, threatRange * threatRange);
    for (let i = 0; i < projectiles.length; i++) {
        const projectile = projectiles[i];
        if (!projectile || !projectile.position || !projectile.velocity) continue;
        if (projectile.owner === player) continue;

        TMP_TO_TARGET.subVectors(player.position, projectile.position);
        const distSq = TMP_TO_TARGET.lengthSq();
        if (distSq > maxDistSq || distSq <= 0.000001) continue;

        TMP_DIRECTION.copy(projectile.velocity);
        if (TMP_DIRECTION.lengthSq() <= 0.000001) continue;
        TMP_DIRECTION.normalize();
        TMP_TO_TARGET.normalize();

        const approachingDot = TMP_DIRECTION.dot(TMP_TO_TARGET);
        if (approachingDot > 0.25) {
            return 1;
        }
    }

    return 0;
}

export function createObservationContext(input = {}) {
    return {
        arena: input.arena || DEFAULT_CONTEXT.arena,
        players: Array.isArray(input.players) ? input.players : DEFAULT_CONTEXT.players,
        projectiles: Array.isArray(input.projectiles) ? input.projectiles : DEFAULT_CONTEXT.projectiles,
        mode: input.mode || DEFAULT_CONTEXT.mode,
        planarMode: !!input.planarMode,
        wallProbeDistance: Math.max(1, Number(input.wallProbeDistance) || DEFAULT_CONTEXT.wallProbeDistance),
        targetDistanceMax: Math.max(1, Number(input.targetDistanceMax) || DEFAULT_CONTEXT.targetDistanceMax),
        projectileThreatRange: Math.max(1, Number(input.projectileThreatRange) || DEFAULT_CONTEXT.projectileThreatRange),
    };
}

export function buildObservation(player, context = {}, target = null) {
    const observation = getObservationTarget(target);
    if (!player || !player.position || !player.quaternion) {
        return observation;
    }

    const runtimeContext = createObservationContext(context);
    const playerInventory = Array.isArray(player.inventory) ? player.inventory : [];
    const inventoryLength = playerInventory.length;
    const selectedItemIndex = inventoryLength > 0
        ? clamp(Number(player.selectedItemIndex) || 0, 0, ITEM_SLOT_COUNT - 1)
        : -1;
    const radius = Math.max(0.1, Number(player.hitboxRadius) || 0.8);

    buildBasisFromPlayer(player);

    const wallFront = sampleWallDistanceRatio(
        runtimeContext.arena,
        player.position,
        TMP_FORWARD,
        radius,
        runtimeContext.wallProbeDistance
    );
    const wallLeft = sampleWallDistanceRatio(
        runtimeContext.arena,
        player.position,
        TMP_LEFT.copy(TMP_RIGHT).multiplyScalar(-1),
        radius,
        runtimeContext.wallProbeDistance
    );
    const wallRight = sampleWallDistanceRatio(
        runtimeContext.arena,
        player.position,
        TMP_RIGHT,
        radius,
        runtimeContext.wallProbeDistance
    );
    const wallUp = sampleWallDistanceRatio(
        runtimeContext.arena,
        player.position,
        TMP_UP,
        radius,
        runtimeContext.wallProbeDistance
    );
    const wallDown = sampleWallDistanceRatio(
        runtimeContext.arena,
        player.position,
        TMP_DOWN.copy(TMP_UP).multiplyScalar(-1),
        radius,
        runtimeContext.wallProbeDistance
    );

    const nearestEnemy = findNearestEnemy(player, runtimeContext.players);
    const projectileThreat = computeProjectileThreat(player, runtimeContext.projectiles, runtimeContext.projectileThreatRange);
    const targetDistanceRatio = normalizeDistanceRatio(
        nearestEnemy.distance,
        runtimeContext.targetDistanceMax,
        1
    );
    const openness = clamp01((wallFront + wallLeft + wallRight + wallUp + wallDown) / 5);
    const pressure = clamp01(
        (1 - wallFront) * 0.42
        + (1 - targetDistanceRatio) * 0.36
        + projectileThreat * 0.55
    );

    observation[SPEED_RATIO] = normalizeSpeedRatio(player.speed, player.baseSpeed);
    observation[HEALTH_RATIO] = normalizeHealthRatio(player.hp, player.maxHp);
    observation[SHIELD_RATIO] = normalizeShieldRatio(player.shieldHP, player.maxShieldHp);
    observation[WALL_DISTANCE_FRONT] = wallFront;
    observation[WALL_DISTANCE_LEFT] = wallLeft;
    observation[WALL_DISTANCE_RIGHT] = wallRight;
    observation[WALL_DISTANCE_UP] = wallUp;
    observation[WALL_DISTANCE_DOWN] = wallDown;
    observation[TARGET_DISTANCE_RATIO] = targetDistanceRatio;
    observation[TARGET_ALIGNMENT] = normalizeSigned(nearestEnemy.alignment, -1, 1, 0);
    observation[TARGET_IN_FRONT] = toBinaryFlag(nearestEnemy.alignment > 0.52);
    observation[PRESSURE_LEVEL] = pressure;
    observation[PROJECTILE_THREAT] = projectileThreat;
    observation[LOCAL_OPENNESS_RATIO] = openness;
    observation[BOOST_ACTIVE] = toBinaryFlag(player.isBoosting);
    observation[INVENTORY_COUNT_RATIO] = normalizeRatio(inventoryLength, ITEM_SLOT_COUNT, 0);
    observation[SELECTED_ITEM_SLOT] = selectedItemIndex;
    observation[PLANAR_MODE_ACTIVE] = toBinaryFlag(runtimeContext.planarMode);
    observation[MODE_ID] = encodeModeId(runtimeContext.mode);
    observation[CONTEXT_RESERVED] = 0;

    encodeItemSlots(playerInventory, observation, ITEM_SLOT_00);
    return observation;
}
