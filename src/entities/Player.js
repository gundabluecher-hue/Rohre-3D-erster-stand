// ============================================
// Player.js - Spieler-Logik (Kampfjet)
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Trail } from './Trail.js';
import { disposeObject3DResources } from '../core/three-disposal.js';
import { createVehicleMesh, isValidVehicleId, VEHICLE_DEFINITIONS } from './vehicle-registry.js';
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
import { updatePlayerMotion } from './player/PlayerMotionOps.js';

// Shared Geometries (einmalig erstellt, von allen Spielern geteilt)
const SHARED_GEO = {};
function _markSharedGeometry(geometry) {
    if (!geometry) return;
    geometry.userData = geometry.userData || {};
    geometry.userData.__sharedNoDispose = true;
}
function _ensureSharedGeo() {
    if (SHARED_GEO.body) return;
    SHARED_GEO.body = new THREE.ConeGeometry(0.35, 3.2, 8);
    SHARED_GEO.body.rotateX(Math.PI / 2);
    SHARED_GEO.cockpit = new THREE.SphereGeometry(0.28, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    SHARED_GEO.nozzle = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 8);
    SHARED_GEO.nozzle.rotateX(Math.PI / 2);
    SHARED_GEO.flameInner = new THREE.ConeGeometry(0.15, 1.0, 8);
    SHARED_GEO.flameInner.rotateX(-Math.PI / 2);
    SHARED_GEO.flameMid = new THREE.ConeGeometry(0.22, 1.4, 8);
    SHARED_GEO.flameMid.rotateX(-Math.PI / 2);
    SHARED_GEO.flameOuter = new THREE.ConeGeometry(0.28, 1.8, 8);
    SHARED_GEO.flameOuter.rotateX(-Math.PI / 2);
    SHARED_GEO.shield = new THREE.SphereGeometry(1.5, 8, 8);
    SHARED_GEO.shieldBox = new THREE.BoxGeometry(1, 1, 1);
    // Flügel-Geometrien
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0); wingShape.lineTo(-1.8, 0.6); wingShape.lineTo(-0.3, 0.8); wingShape.lineTo(0, 0);
    SHARED_GEO.wingL = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
    const wingShapeR = new THREE.Shape();
    wingShapeR.moveTo(0, 0); wingShapeR.lineTo(1.8, 0.6); wingShapeR.lineTo(0.3, 0.8); wingShapeR.lineTo(0, 0);
    SHARED_GEO.wingR = new THREE.ExtrudeGeometry(wingShapeR, { depth: 0.06, bevelEnabled: false });
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.lineTo(0, 0.8); finShape.lineTo(0.4, 0.1); finShape.lineTo(0, 0);
    SHARED_GEO.fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });

    for (const geo of Object.values(SHARED_GEO)) {
        _markSharedGeometry(geo);
    }
}

export class Player {
    constructor(renderer, index, color, isBot = false, options = {}) {
        this.renderer = renderer;
        this.index = index;
        this.color = color;
        this.isBot = isBot;
        this.alive = true;
        this.score = 0;

        // Physik
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3(0, 0, -1);
        this.quaternion = new THREE.Quaternion();
        this.speed = CONFIG.PLAYER.SPEED;
        this.baseSpeed = CONFIG.PLAYER.SPEED;

        // Wiederverwendbare Temp-Objekte (vermeidet GC-Druck)
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

        // Powerup-Effekte
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

        // Spezial-Gate Effekte
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

        const vehicleDef = VEHICLE_DEFINITIONS.find(v => v.id === this.vehicleId) || VEHICLE_DEFINITIONS[0];
        this.hitboxRadius = (vehicleDef.hitbox?.radius || CONFIG.PLAYER.HITBOX_RADIUS || 0.8) * this.modelScale;

        // Lokale Bounding-Box für präzise OBB-Kollision
        this.hitboxBox = new THREE.Box3();
        const r = this.hitboxRadius;
        this.hitboxBox.set(new THREE.Vector3(-r, -r * 0.7, -r), new THREE.Vector3(r, r * 0.7, r));

        this._tmpWorldToLocal = new THREE.Matrix4();
        this._tmpLocalPoint = new THREE.Vector3();
        this._tmpLocalSphere = new THREE.Sphere();
        this._shieldBaseScale = new THREE.Vector3(1, 1, 1);

        this.vehicleMesh = null;
        this._vehicleBounds = { minZ: -1.95, maxZ: 1.9, sizeY: 1.0 };
        this._onVehicleLoaded = null;
        this._vehicleLoadedTarget = null;

        // Kamera-Modus
        this.cameraMode = 0;

        // 3D-Modell (Dynamisch über Registry)
        this._createModel();

        // Trail
        this.trail = new Trail(renderer, color, this.index, options.entityManager);
        resetPlayerHealth(this);
    }

    _createModel() {
        this.group = new THREE.Group();

        // Create vehicle mesh from registry
        this.vehicleMesh = createVehicleMesh(this.vehicleId, this.color);
        this.group.add(this.vehicleMesh);
        const mesh = this.vehicleMesh;

        const updateBox = () => {
            const currentMesh = this.vehicleMesh;
            if (!currentMesh || currentMesh !== mesh || !this.group) return;

            if (currentMesh.localBox) {
                this.hitboxBox.copy(currentMesh.localBox);
            } else {
                currentMesh.updateMatrixWorld(true);
                const invMatrix = this._tmpMat.copy(currentMesh.matrixWorld).invert();
                this.hitboxBox.setFromObject(currentMesh).applyMatrix4(invMatrix);
            }

            // Kraftfeld-Box an OBB anpassen
            if (this.shieldMesh) {
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                this.hitboxBox.getSize(size);
                this.hitboxBox.getCenter(center);

                // Etwas Puffer (15% größer)
                this._shieldBaseScale.set(size.x * 1.15, size.y * 1.15, size.z * 1.15);
                this.shieldMesh.scale.copy(this._shieldBaseScale);
                this.shieldMesh.position.copy(center);
            }
        };

        if (mesh?.addEventListener) {
            this._onVehicleLoaded = updateBox;
            this._vehicleLoadedTarget = mesh;
            mesh.addEventListener('loaded', updateBox);
        }
        updateBox();

        // First Person Anchor (fallback if not provided by mesh)
        this.firstPersonAnchor = new THREE.Object3D();
        if (this.vehicleMesh.firstPersonAnchor) {
            this.firstPersonAnchor = this.vehicleMesh.firstPersonAnchor;
        } else {
            this.firstPersonAnchor.position.set(
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_X || 0,
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_Y || 0,
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_Z || -2
            );
            this.group.add(this.firstPersonAnchor);
        }

        // --- Kraftfeld-Box (shared Geometry) ---
        _ensureSharedGeo();
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0,
            wireframe: true,
            side: THREE.BackSide, // Auch von innen sichtbar
            depthWrite: false,
        });
        this.shieldMesh = new THREE.Mesh(SHARED_GEO.shieldBox, shieldMat);

        // Zweite Ebene für "Glow"-Effekt
        const innerShield = new THREE.Mesh(SHARED_GEO.shieldBox, new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0,
            wireframe: false,
            depthWrite: false,
        }));
        innerShield.name = "innerShield";
        this.shieldMesh.add(innerShield);
        innerShield.scale.set(0.98, 0.98, 0.98);

        this.group.add(this.shieldMesh);

        this.renderer.addToScene(this.group);
        this._applyModelScale();

        // Compatibility: extract flames if they exist in the vehicle mesh
        this.flames = [];
        this.vehicleMesh.traverse((child) => {
            if (child.name === 'flame' || (child.material && child.material.name === 'flame')) {
                this.flames.push(child);
            }
        });
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
        // Planar Mode State: keep the spawn level chosen by the spawner.
        const fallbackY = CONFIG.PLAYER.START_Y || 5;
        const spawnY = Number.isFinite(position?.y) ? position.y : fallbackY;
        this.currentPlanarY = CONFIG.GAMEPLAY.PLANAR_MODE ? spawnY : fallbackY;
        this.trail.clear();
        this.trail.resetWidth();
        this.group.visible = true;

        // Zufällige Startrichtung
        if (startDirection && startDirection.lengthSq() > 0.0001) {
            this._tmpVec.copy(startDirection).normalize();
            this.quaternion.setFromUnitVectors(this._tmpDir.set(0, 0, -1), this._tmpVec);
        } else {
            const angle = Math.random() * Math.PI * 2;
            this._tmpEuler.set(0, angle, 0, 'YXZ'); this.quaternion.setFromEuler(this._tmpEuler);
        }

        this._updateModel();
    }

    lockSteering(seconds = 0.2) {
        const duration = Number(seconds);
        if (!Number.isFinite(duration) || duration <= 0) return;
        this.steeringLockTimer = Math.max(this.steeringLockTimer || 0, duration);
    }

    update(dt, input) {
        if (!this.alive) return;
        this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
        this.steeringLockTimer = Math.max(0, (this.steeringLockTimer || 0) - dt);
        this.shieldHitFeedback = Math.max(0, (this.shieldHitFeedback || 0) - dt * 3.2);
        const steeringLocked = this.steeringLockTimer > 0;
        updatePlayerHealthRegen(this, dt);

        // Effekte aktualisieren
        this._updateEffects(dt);
        updatePlayerMotion(this, dt, input, steeringLocked);
    }

    _updateModel() {
        this.group.position.copy(this.position);
        this.group.quaternion.copy(this.quaternion);

        const time = performance.now() * 0.001;

        // --- Flammen-Animation ---
        if (this.flames && this.flames.length > 0) {
            const boostFactor = this.isBoosting ? 3.0 : 1.0;
            const flicker = Math.sin(time * 25) * 0.15 + Math.sin(time * 37) * 0.1;

            for (let i = 0; i < this.flames.length; i++) {
                const flame = this.flames[i];
                if (!flame) continue;

                const depthOffset = i * 0.05;
                const scaleZ = (0.4 - depthOffset + flicker * (0.3 - depthOffset)) * boostFactor;
                flame.scale.set(1, 1, Math.max(0.1, scaleZ));

                if (flame.material) {
                    flame.material.opacity = this.isBoosting ? 1.0 : 0.7;

                    if (this.isBoosting) {
                        flame.material.color.setHex(i % 2 === 0 ? 0xffffff : 0xffaa33);
                    } else {
                        flame.material.color.setHex(i % 2 === 0 ? 0xffffaa : 0xff8800);
                    }
                }
            }
        }

        // Kraftfeld-Visualisierung (Box)
        if (this.shieldMesh) {
            this.shieldMesh.visible = this.hasShield;
            if (this.hasShield) {
                const shieldRatio = Math.max(0, Math.min(1, this.shieldHP / Math.max(1, this.maxShieldHp || 1)));
                const hitPulse = Math.max(0, Math.min(1, this.shieldHitFeedback || 0));
                const flicker = Math.sin(time * 6) * 0.12;
                this.shieldMesh.material.opacity = Math.max(0.08, 0.18 + shieldRatio * 0.24 + hitPulse * 0.32 + flicker);
                this.shieldMesh.scale.copy(this._shieldBaseScale).multiplyScalar(
                    Math.max(0.68, 0.9 + shieldRatio * 0.12 - hitPulse * 0.18)
                );

                const inner = this.shieldMesh.getObjectByName("innerShield");
                if (inner) {
                    inner.material.opacity = Math.max(0.04, 0.08 + shieldRatio * 0.14 + hitPulse * 0.18 + Math.sin(time * 9 + 1.5) * 0.05);
                }
            }
        }
    }

    _updateEffects(dt) {
        updatePlayerEffects(this, dt);
    }

    _applyModelScale() {
        if (this.group) {
            this.group.scale.setScalar(this.modelScale);
        }
    }

    setControlOptions(options = {}) {
        if (typeof options.invertPitch === 'boolean') {
            this.invertPitchBase = options.invertPitch;
        }
        if (typeof options.modelScale === 'number') {
            this.modelScale = options.modelScale;
            this._applyModelScale();
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
        this.group.visible = false;
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
        const target = out || new THREE.Vector3();
        if (this.firstPersonAnchor) {
            this.firstPersonAnchor.getWorldPosition(target);
            return target;
        }

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
        if (this._vehicleLoadedTarget?.removeEventListener && this._onVehicleLoaded) {
            this._vehicleLoadedTarget.removeEventListener('loaded', this._onVehicleLoaded);
        }
        this._onVehicleLoaded = null;
        this._vehicleLoadedTarget = null;
        this.trail.dispose();
        if (this.group) {
            this.renderer.removeFromScene(this.group);
            disposeObject3DResources(this.group);
        }
        this.vehicleMesh = null;
        this.shieldMesh = null;
        this.firstPersonAnchor = null;
        this.flames = [];
        this.group = null;
    }

    isSphereInOBB(worldCenter, radius) {
        if (!this.alive) return false;

        this._tmpWorldToLocal.copy(this.group.matrixWorld).invert();
        this._tmpLocalSphere.center.copy(worldCenter).applyMatrix4(this._tmpWorldToLocal);
        this._tmpLocalSphere.radius = radius;

        return this.hitboxBox.intersectsSphere(this._tmpLocalSphere);
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
