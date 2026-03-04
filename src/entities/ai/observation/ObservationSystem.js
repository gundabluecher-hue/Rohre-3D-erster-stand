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
import {
    buildPerceptionBasis,
    computeProjectileThreatFlag,
    findNearestEnemySample,
    PERCEPTION_THRESHOLDS,
    sampleWallDistance,
} from '../perception/EnvironmentSamplingOps.js';

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
    buildPerceptionBasis(TMP_FORWARD, TMP_RIGHT, TMP_UP, WORLD_UP);
}

function sampleWallDistanceRatio(arena, origin, direction, radius, maxDistance, steps = 20) {
    const safeMaxDistance = Math.max(1, Number(maxDistance) || 1);
    const distance = sampleWallDistance(arena, origin, direction, radius, safeMaxDistance, steps, TMP_PROBE);
    return normalizeDistanceRatio(distance, safeMaxDistance, 0);
}

function findNearestEnemy(player, players) {
    const sample = findNearestEnemySample(player, players, TMP_FORWARD, TMP_TO_TARGET);
    return {
        nearest: sample.nearest,
        distance: Number.isFinite(sample.distanceSq) ? Math.sqrt(sample.distanceSq) : Infinity,
        alignment: sample.alignment,
    };
}

function computeProjectileThreat(player, projectiles, threatRange) {
    return computeProjectileThreatFlag(player, projectiles, threatRange, {
        approachDot: PERCEPTION_THRESHOLDS.projectileApproachDot,
        toTarget: TMP_TO_TARGET,
        direction: TMP_DIRECTION,
    });
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
    observation[TARGET_IN_FRONT] = toBinaryFlag(nearestEnemy.alignment > PERCEPTION_THRESHOLDS.targetInFrontDot);
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
