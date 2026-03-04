// ============================================
// Player.js - player state and orchestration
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Trail } from './Trail.js';
import { isValidVehicleId, VEHICLE_DEFINITIONS } from './vehicle-registry.js';
import {
    applyDamage,
    applyHealing,
    resetPlayerHealth,
    updatePlayerHealthRegen,
} from '../hunt/HealthSystem.js';
import {
    applyPlayerPowerup,
    removePlayerEffect,
    updatePlayerEffects,
} from './player/PlayerEffectOps.js';
import {
    addPlayerInventoryItem,
    cyclePlayerInventoryItem,
    dropPlayerInventoryItem,
    usePlayerInventoryItem,
} from './player/PlayerInventoryOps.js';
import {
    initializePlayerHitbox,
    isSphereInPlayerOBB,
    setPlayerLookAtWorld,
    updatePlayerMotion,
} from './player/PlayerMotionOps.js';
import { PlayerController } from './player/PlayerController.js';
import { PlayerView } from './player/PlayerView.js';

export class Player {
    constructor(renderer, index, color, isBot = false, options = {}) {
        this.renderer = renderer;
        this.index = index;
        this.color = color;
        this.isBot = isBot;
        this.alive = true;
        this.score = 0;

        // Physics
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3(0, 0, -1);
        this.quaternion = new THREE.Quaternion();
        this.speed = CONFIG.PLAYER.SPEED;
        this.baseSpeed = CONFIG.PLAYER.SPEED;

        // Reused temp objects
        this._tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this._tmpEuler2 = new THREE.Euler(0, 0, 0, 'YXZ');
        this._tmpQuat = new THREE.Quaternion();
        this._tmpVec = new THREE.Vector3();
        this._tmpDir = new THREE.Vector3();
        this._tmpAimRight = new THREE.Vector3();
        this._tmpAimUp = new THREE.Vector3();
        this._tmpMat = new THREE.Matrix4();

        // Boost
        this.boostTimer = 0;
        this.boostCooldown = 0;
        this.isBoosting = false;

        // Powerup effects
        this.activeEffects = [];
        this.inventory = [];
        this.selectedItemIndex = 0;
        this.hasShield = false;
        this.shieldHP = 0;
        this.maxShieldHp = 1;
        this.shieldHitFeedback = 0;
        this.isGhost = false;
        this.invertControls = false;
        this.maxHp = 1;
        this.hp = 1;
        this.lastDamageTimestamp = -Infinity;
        this.invertPitchBase = false;
        this.modelScale = CONFIG.PLAYER.MODEL_SCALE || 1;
        this.cockpitCamera = false;
        this.spawnProtectionTimer = 0;
        this.planarAimOffset = 0;
        this.steeringLockTimer = 0;

        // Special gate effects
        this.boostPortalTimer = 0;
        this.boostPortalParams = null;
        this.boostPortalDir = new THREE.Vector3();

        this.slingshotTimer = 0;
        this.slingshotParams = null;
        this.slingshotForward = new THREE.Vector3();
        this.slingshotUp = new THREE.Vector3();

        const requestedVehicleId = String(options?.vehicleId || '').trim();
        this.vehicleId = isValidVehicleId(requestedVehicleId)
            ? requestedVehicleId
            : String(CONFIG.PLAYER.DEFAULT_VEHICLE_ID || 'ship5');

        const vehicleDef = VEHICLE_DEFINITIONS.find((v) => v.id === this.vehicleId) || VEHICLE_DEFINITIONS[0];
        this.hitboxRadius = (vehicleDef.hitbox?.radius || CONFIG.PLAYER.HITBOX_RADIUS || 0.8) * this.modelScale;

        // Hitbox state
        this.hitboxBox = new THREE.Box3();
        this.hitboxSize = new THREE.Vector3();
        this.hitboxCenter = new THREE.Vector3();

        this._tmpWorldToLocal = new THREE.Matrix4();
        this._tmpLocalSphere = new THREE.Sphere();
        this._tmpHitboxScale = new THREE.Vector3(1, 1, 1);
        this._shieldBaseScale = new THREE.Vector3(1, 1, 1);

        initializePlayerHitbox(this, this.hitboxRadius);

        // View refs (kept on player for compatibility)
        this.group = null;
        this.vehicleMesh = null;
        this.shieldMesh = null;
        this.firstPersonAnchor = null;
        this.flames = [];

        this.cameraMode = 0;

        this.controller = new PlayerController();
        this.view = new PlayerView(this, renderer);
        this.view.createModel();

        this.trail = new Trail(renderer, color, this.index, options.entityManager);
        resetPlayerHealth(this);
    }

    spawn(position, startDirection = null) {
        this.position.copy(position);
        this.alive = true;
        this.speed = this.baseSpeed;
        this.boostTimer = 0;
        this.boostCooldown = 0;
        this.isBoosting = false;
        this.activeEffects = [];
        this.hasShield = false;
        this.isGhost = false;
        this.invertControls = false;
        this.spawnProtectionTimer = CONFIG.PLAYER.SPAWN_PROTECTION || 0;
        this.planarAimOffset = 0;
        this.steeringLockTimer = 0;
        resetPlayerHealth(this);

        const fallbackY = CONFIG.PLAYER.START_Y || 5;
        const spawnY = Number.isFinite(position?.y) ? position.y : fallbackY;
        this.currentPlanarY = CONFIG.GAMEPLAY.PLANAR_MODE ? spawnY : fallbackY;

        this.trail.clear();
        this.trail.resetWidth();
        this.view?.setVisible(true);

        if (startDirection && startDirection.lengthSq() > 0.0001) {
            this._tmpVec.copy(startDirection).normalize();
            this.quaternion.setFromUnitVectors(this._tmpDir.set(0, 0, -1), this._tmpVec);
        } else {
            const angle = Math.random() * Math.PI * 2;
            this._tmpEuler.set(0, angle, 0, 'YXZ');
            this.quaternion.setFromEuler(this._tmpEuler);
        }

        this.view?.syncFromState();
    }

    lockSteering(seconds = 0.2) {
        const duration = Number(seconds);
        if (!Number.isFinite(duration) || duration <= 0) return;
        this.steeringLockTimer = Math.max(this.steeringLockTimer || 0, duration);
    }

    setLookAtWorld(x, y, z) {
        const success = setPlayerLookAtWorld(this, x, y, z);
        if (success) {
            this.view?.syncRotation();
        }
        return success;
    }

    update(dt, input) {
        if (!this.alive) return;

        this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
        this.steeringLockTimer = Math.max(0, (this.steeringLockTimer || 0) - dt);
        this.shieldHitFeedback = Math.max(0, (this.shieldHitFeedback || 0) - dt * 3.2);
        const steeringLocked = this.steeringLockTimer > 0;

        updatePlayerHealthRegen(this, dt);
        updatePlayerEffects(this, dt);

        const controlState = this.controller.resolveControlState(this, input, steeringLocked);
        updatePlayerMotion(this, dt, controlState);

        this.view?.update(dt);
    }

    setControlOptions(options = {}) {
        if (typeof options.invertPitch === 'boolean') {
            this.invertPitchBase = options.invertPitch;
        }
        if (typeof options.modelScale === 'number') {
            this.modelScale = options.modelScale;
            this.view?.applyModelScale();
        }
        if (typeof options.cockpitCamera === 'boolean') {
            this.cockpitCamera = options.cockpitCamera;
        }
    }

    applyPowerup(type) {
        applyPlayerPowerup(this, type);
    }

    _removeEffect(effect) {
        removePlayerEffect(this, effect);
    }

    addToInventory(type) {
        return addPlayerInventoryItem(this, type);
    }

    cycleItem() {
        cyclePlayerInventoryItem(this);
    }

    useItem() {
        return usePlayerInventoryItem(this);
    }

    dropItem() {
        return dropPlayerInventoryItem(this);
    }

    kill() {
        this.alive = false;
        this.hp = 0;
        this.view?.setVisible(false);
    }

    takeDamage(amount, options = {}) {
        const result = applyDamage(this, amount, options);
        if (result.isDead && this.alive) {
            this.kill();
        }
        return result;
    }

    heal(amount) {
        return applyHealing(this, amount);
    }

    isDead() {
        return !this.alive || this.hp <= 0;
    }

    getDirection(out = null) {
        if (out) {
            return out.set(0, 0, -1).applyQuaternion(this.quaternion);
        }
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion);
    }

    getFirstPersonCameraAnchor(out = null) {
        if (this.view) {
            return this.view.getFirstPersonCameraAnchor(out);
        }

        const target = out || new THREE.Vector3();
        this.getDirection(this._tmpDir);
        return target.copy(this.position).add(this._tmpDir);
    }

    getAimDirection(out = null) {
        const target = out || new THREE.Vector3();
        this.getDirection(target).normalize();

        if (!CONFIG.GAMEPLAY.PLANAR_MODE) {
            return target;
        }

        const aimOffset = Math.min(1, Math.max(-1, this.planarAimOffset || 0));
        if (Math.abs(aimOffset) < 0.0001) {
            return target;
        }

        this._tmpAimRight.crossVectors(this._tmpDir.set(0, 1, 0), target);
        if (this._tmpAimRight.lengthSq() < 0.000001) {
            this._tmpAimRight.set(1, 0, 0);
        } else {
            this._tmpAimRight.normalize();
        }
        this._tmpAimUp.crossVectors(target, this._tmpAimRight).normalize();

        const angleRad = THREE.MathUtils.degToRad(CONFIG.PROJECTILE.PLANAR_AIM_MAX_ANGLE_DEG) * aimOffset;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        target.multiplyScalar(cosA).addScaledVector(this._tmpAimUp, sinA).normalize();
        return target;
    }

    dispose() {
        this.trail.dispose();
        this.view?.dispose();

        this.vehicleMesh = null;
        this.shieldMesh = null;
        this.firstPersonAnchor = null;
        this.flames = [];
        this.group = null;

        this.controller = null;
        this.view = null;
    }

    isSphereInOBB(worldCenter, radius) {
        return isSphereInPlayerOBB(this, worldCenter, radius);
    }

    activateBoostPortal(params, forward) {
        this.boostPortalTimer = params.duration || 1.5;
        this.boostPortalParams = params;
        this.boostPortalDir.copy(forward);

        this.boostTimer = Math.max(this.boostTimer, this.boostPortalTimer);
        this.isBoosting = true;
    }

    activateSlingshot(params, forward, up) {
        this.slingshotTimer = params.duration || 2.0;
        this.slingshotParams = params;
        this.slingshotForward.copy(forward);
        this.slingshotUp.copy(up);

        this.lockSteering(0.15);
    }
}
