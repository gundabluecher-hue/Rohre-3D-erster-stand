import { CONFIG } from '../../core/Config.js';

const MIN_HITBOX_RADIUS = 0.2;
const HITBOX_HEIGHT_FACTOR = 0.7;

function applyFallbackHitbox(player, fallbackRadius) {
    player.hitboxBox.set(
        player._tmpVec.set(-fallbackRadius, -fallbackRadius * HITBOX_HEIGHT_FACTOR, -fallbackRadius),
        player._tmpDir.set(fallbackRadius, fallbackRadius * HITBOX_HEIGHT_FACTOR, fallbackRadius)
    );
}

function updateHitboxDerivedState(player) {
    if (!player?.hitboxBox || !player?.hitboxSize || !player?.hitboxCenter) return;
    player.hitboxBox.getSize(player.hitboxSize);
    player.hitboxBox.getCenter(player.hitboxCenter);
}

function hasValidHitbox(box) {
    if (!box || box.isEmpty()) return false;
    const min = box.min;
    const max = box.max;
    return Number.isFinite(min.x)
        && Number.isFinite(min.y)
        && Number.isFinite(min.z)
        && Number.isFinite(max.x)
        && Number.isFinite(max.y)
        && Number.isFinite(max.z);
}

export function initializePlayerHitbox(player, radius) {
    if (!player?.hitboxBox) return;
    const fallbackRadius = Math.max(MIN_HITBOX_RADIUS, Number(radius) || Number(CONFIG.PLAYER.HITBOX_RADIUS) || 0.8);
    applyFallbackHitbox(player, fallbackRadius);
    updateHitboxDerivedState(player);
}

export function syncPlayerHitboxFromVehicleMesh(player, mesh = null) {
    if (!player?.hitboxBox) return null;

    const targetMesh = mesh || player.vehicleMesh;
    const fallbackRadius = Math.max(MIN_HITBOX_RADIUS, Number(player.hitboxRadius) || Number(CONFIG.PLAYER.HITBOX_RADIUS) || 0.8);

    if (!targetMesh) {
        applyFallbackHitbox(player, fallbackRadius);
        updateHitboxDerivedState(player);
        return player.hitboxBox;
    }

    if (targetMesh.localBox) {
        player.hitboxBox.copy(targetMesh.localBox);
    } else {
        targetMesh.updateMatrixWorld?.(true);
        if (player._tmpMat && targetMesh.matrixWorld) {
            const inverse = player._tmpMat.copy(targetMesh.matrixWorld).invert();
            player.hitboxBox.setFromObject(targetMesh).applyMatrix4(inverse);
        } else {
            player.hitboxBox.setFromObject(targetMesh);
        }
    }

    if (!hasValidHitbox(player.hitboxBox)) {
        applyFallbackHitbox(player, fallbackRadius);
    }

    updateHitboxDerivedState(player);
    return player.hitboxBox;
}

export function updatePlayerMotion(player, dt, controlState = null) {
    const turnSpeed = CONFIG.PLAYER.TURN_SPEED * dt;
    const rollSpeed = CONFIG.PLAYER.ROLL_SPEED * dt;

    const pitchInput = Number(controlState?.pitchInput) || 0;
    const yawInput = Number(controlState?.yawInput) || 0;
    const rollInput = Number(controlState?.rollInput) || 0;
    const wantsBoost = !!controlState?.boost;

    if (wantsBoost && player.boostCooldown <= 0 && !player.isBoosting) {
        player.isBoosting = true;
        player.boostTimer = CONFIG.PLAYER.BOOST_DURATION;
    }

    player._tmpEuler.set(
        pitchInput * turnSpeed,
        yawInput * turnSpeed,
        rollInput * rollSpeed,
        'YXZ'
    );
    player._tmpQuat.setFromEuler(player._tmpEuler);
    player.quaternion.multiply(player._tmpQuat);

    if (CONFIG.PLAYER.AUTO_ROLL && rollInput === 0) {
        player._tmpEuler2.setFromQuaternion(player.quaternion, 'YXZ');
        player._tmpEuler2.z *= (1 - CONFIG.PLAYER.AUTO_ROLL_SPEED * dt);

        if (CONFIG.GAMEPLAY.PLANAR_MODE) {
            player._tmpEuler2.x = 0;
        }

        player.quaternion.setFromEuler(player._tmpEuler2);
    } else if (CONFIG.GAMEPLAY.PLANAR_MODE) {
        player._tmpEuler2.setFromQuaternion(player.quaternion, 'YXZ');
        player._tmpEuler2.x = 0;
        player.quaternion.setFromEuler(player._tmpEuler2);
    }

    if (player.isBoosting) {
        player.boostTimer -= dt;
        player.speed = player.baseSpeed * CONFIG.PLAYER.BOOST_MULTIPLIER;
        if (player.boostTimer <= 0) {
            player.isBoosting = false;
            player.boostCooldown = CONFIG.PLAYER.BOOST_COOLDOWN;
            player.speed = player.baseSpeed;
        }
    }
    if (player.boostCooldown > 0) {
        player.boostCooldown -= dt;
    }

    player._tmpVec.set(0, 0, -1).applyQuaternion(player.quaternion);
    player.velocity.copy(player._tmpVec).multiplyScalar(player.speed);

    if (player.boostPortalTimer > 0) {
        const factor = Math.min(1, player.boostPortalTimer / 0.5);
        const strength = (player.boostPortalParams?.forwardImpulse || 40) * factor;
        player.velocity.addScaledVector(player.boostPortalDir, strength);
        player.speed = Math.max(player.speed, (player.boostPortalParams?.bonusSpeed || 50));
    }

    if (player.slingshotTimer > 0) {
        const factor = Math.min(1, player.slingshotTimer / 1.0);
        const fStrength = (player.slingshotParams?.forwardImpulse || 25) * factor;
        const uStrength = (player.slingshotParams?.liftImpulse || 5) * factor;
        player.velocity.addScaledVector(player.slingshotForward, fStrength);
        player.velocity.addScaledVector(player.slingshotUp, uStrength);
    }

    if (CONFIG.GAMEPLAY.PLANAR_MODE) {
        player.velocity.y = 0;
        player.position.y = player.currentPlanarY;
    }

    player.position.x += player.velocity.x * dt;
    if (!CONFIG.GAMEPLAY.PLANAR_MODE) {
        player.position.y += player.velocity.y * dt;
    }
    player.position.z += player.velocity.z * dt;
}

export function setPlayerLookAtWorld(player, x, y, z) {
    if (!player?.position || !player?.quaternion) return false;

    const tx = Number(x);
    const ty = Number(y);
    const tz = Number(z);
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)) {
        return false;
    }

    player._tmpVec.set(tx, ty, tz).sub(player.position);
    if (player._tmpVec.lengthSq() <= 0.000001) {
        return false;
    }

    player._tmpVec.normalize();
    player.quaternion.setFromUnitVectors(player._tmpDir.set(0, 0, -1), player._tmpVec);
    return true;
}

export function isSphereInPlayerOBB(player, worldCenter, radius) {
    if (!player?.alive || !player?.hitboxBox || !worldCenter) return false;

    if (player.group?.matrixWorld) {
        player._tmpWorldToLocal.copy(player.group.matrixWorld).invert();
    } else {
        if (!player._tmpHitboxScale) return false;
        const scaleValue = Number(player.modelScale) || 1;
        player._tmpWorldToLocal.compose(
            player.position,
            player.quaternion,
            player._tmpHitboxScale.set(scaleValue, scaleValue, scaleValue)
        ).invert();
    }

    player._tmpLocalSphere.center.copy(worldCenter).applyMatrix4(player._tmpWorldToLocal);
    player._tmpLocalSphere.radius = radius;

    return player.hitboxBox.intersectsSphere(player._tmpLocalSphere);
}
