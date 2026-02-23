// ============================================
// Player.js - Spieler-Logik (Kampfjet)
// ============================================

import * as THREE from 'three';
import { CONFIG } from './Config.js';
import { Trail } from './Trail.js';
import { disposeObject3DResources } from './three-disposal.js';
import { createVehicleMesh, isValidVehicleId, VEHICLE_DEFINITIONS } from '../entities/vehicle-registry.js';

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
        this.isGhost = false;
        this.invertControls = false;
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

        this.vehicleMesh = null;
        this._vehicleBounds = { minZ: -1.95, maxZ: 1.9, sizeY: 1.0 };

        // Kamera-Modus
        this.cameraMode = 0;

        // 3D-Modell (Dynamisch über Registry)
        this._createModel();

        // Trail
        this.trail = new Trail(renderer, color, this.index, options.entityManager);
    }

    _createModel() {
        this.group = new THREE.Group();

        // Create vehicle mesh from registry
        this.vehicleMesh = createVehicleMesh(this.vehicleId, this.color);
        this.group.add(this.vehicleMesh);

        const updateBox = () => {
            if (this.vehicleMesh.localBox) {
                this.hitboxBox.copy(this.vehicleMesh.localBox);
            } else {
                this.vehicleMesh.updateMatrixWorld(true);
                const invMatrix = this._tmpMat.copy(this.vehicleMesh.matrixWorld).invert();
                this.hitboxBox.setFromObject(this.vehicleMesh).applyMatrix4(invMatrix);
            }

            // Kraftfeld-Box an OBB anpassen
            if (this.shieldMesh) {
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                this.hitboxBox.getSize(size);
                this.hitboxBox.getCenter(center);

                // Etwas Puffer (15% größer)
                this.shieldMesh.scale.set(size.x * 1.15, size.y * 1.15, size.z * 1.15);
                this.shieldMesh.position.copy(center);
            }
        };

        if (this.vehicleMesh.addEventListener) {
            this.vehicleMesh.addEventListener('loaded', updateBox);
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
        const steeringLocked = this.steeringLockTimer > 0;

        // Effekte aktualisieren
        this._updateEffects(dt);

        // Steuerung
        const turnSpeed = CONFIG.PLAYER.TURN_SPEED * dt;
        const rollSpeed = CONFIG.PLAYER.ROLL_SPEED * dt;

        let pitchInput = 0;
        let yawInput = 0;
        let rollInput = 0;

        if (input) {
            pitchInput = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
            yawInput = (input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0);
            rollInput = (input.rollLeft ? 1 : 0) - (input.rollRight ? 1 : 0);

            // Invertierte Steuerung?
            if (this.invertPitchBase) {
                pitchInput *= -1;
            }

            // Invertierte Steuerung durch Effekt?
            if (this.invertControls) {
                pitchInput *= -1;
                yawInput *= -1;
            }

            // Planar Mode: Ignore pitch input
            if (CONFIG.GAMEPLAY.PLANAR_MODE) {
                pitchInput = 0;
            }

            // Boost
            if (!steeringLocked && input.boost && this.boostCooldown <= 0 && !this.isBoosting) {
                this.isBoosting = true;
                this.boostTimer = CONFIG.PLAYER.BOOST_DURATION;
            }
        }

        if (steeringLocked) {
            pitchInput = 0;
            yawInput = 0;
            rollInput = 0;
        }

        // Rotation anwenden (wiederverwendbare Objekte)
        this._tmpEuler.set(
            pitchInput * turnSpeed,
            yawInput * turnSpeed,
            rollInput * rollSpeed,
            'YXZ'
        );
        this._tmpQuat.setFromEuler(this._tmpEuler);
        this.quaternion.multiply(this._tmpQuat);

        // Auto-Roll (Stabilisierung)
        if (CONFIG.PLAYER.AUTO_ROLL && rollInput === 0) {
            this._tmpEuler2.setFromQuaternion(this.quaternion, 'YXZ');
            this._tmpEuler2.z *= (1 - CONFIG.PLAYER.AUTO_ROLL_SPEED * dt);

            if (CONFIG.GAMEPLAY.PLANAR_MODE) {
                this._tmpEuler2.x = 0; // Strict pitch lock 
            }

            this.quaternion.setFromEuler(this._tmpEuler2);
        } else if (CONFIG.GAMEPLAY.PLANAR_MODE) {
            // Strict pitch lock even if rolling
            this._tmpEuler2.setFromQuaternion(this.quaternion, 'YXZ');
            this._tmpEuler2.x = 0;
            this.quaternion.setFromEuler(this._tmpEuler2);
        }

        // Boost-Logik
        if (this.isBoosting) {
            this.boostTimer -= dt;
            this.speed = this.baseSpeed * CONFIG.PLAYER.BOOST_MULTIPLIER;
            if (this.boostTimer <= 0) {
                this.isBoosting = false;
                this.boostCooldown = CONFIG.PLAYER.BOOST_COOLDOWN;
                this.speed = this.baseSpeed;
            }
        }
        if (this.boostCooldown > 0) {
            this.boostCooldown -= dt;
        }

        // Vorwärtsbewegung
        this._tmpVec.set(0, 0, -1).applyQuaternion(this.quaternion);
        this.velocity.copy(this._tmpVec).multiplyScalar(this.speed);

        // ---- Spezial-Gate Effekte anwenden ----
        if (this.boostPortalTimer > 0) {
            // Starker Vorwärtsschub in Gate-Richtung
            const factor = Math.min(1, this.boostPortalTimer / 0.5); // Ease out
            const strength = (this.boostPortalParams?.forwardImpulse || 40) * factor;
            this.velocity.addScaledVector(this.boostPortalDir, strength);

            // Speed Surge (temporäre Erhöhung des Limits)
            this.speed = Math.max(this.speed, (this.boostPortalParams?.bonusSpeed || 50));
        }

        if (this.slingshotTimer > 0) {
            // Impuls + Lift
            const factor = Math.min(1, this.slingshotTimer / 1.0);
            const fStrength = (this.slingshotParams?.forwardImpulse || 25) * factor;
            const uStrength = (this.slingshotParams?.liftImpulse || 5) * factor;

            this.velocity.addScaledVector(this.slingshotForward, fStrength);
            this.velocity.addScaledVector(this.slingshotUp, uStrength);
        }

        if (CONFIG.GAMEPLAY.PLANAR_MODE) {
            this.velocity.y = 0;
            // Use currentPlanarY instead of static constant
            this.position.y = this.currentPlanarY;
        }

        this.position.x += this.velocity.x * dt;
        if (!CONFIG.GAMEPLAY.PLANAR_MODE) {
            this.position.y += this.velocity.y * dt;
        }
        this.position.z += this.velocity.z * dt;

        // Trail aktualisieren
        this.trail.update(dt, this.position, this._tmpVec);

        // Modell-Animationen
        if (this.vehicleMesh && typeof this.vehicleMesh.tick === 'function') {
            this.vehicleMesh.tick(dt);
        }

        // Modell updaten
        this._updateModel();

        // Matrix für Kollisionsprüfung (OBB) aktualisieren
        this.group.updateMatrixWorld(true);
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
                const shieldOpacity = 0.3 + Math.sin(time * 6) * 0.15;
                this.shieldMesh.material.opacity = shieldOpacity;

                const inner = this.shieldMesh.getObjectByName("innerShield");
                if (inner) {
                    inner.material.opacity = 0.1 + Math.sin(time * 6 + 1) * 0.05;
                }
            }
        }
    }

    _updateEffects(dt) {
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.remaining -= dt;

            if (effect.remaining <= 0) {
                this._removeEffect(effect);
                this.activeEffects.splice(i, 1);
            }
        }

        // Spezial-Gate Timer
        if (this.boostPortalTimer > 0) {
            this.boostPortalTimer -= dt;
            if (this.boostPortalTimer <= 0) this.boostPortalParams = null;
        }
        if (this.slingshotTimer > 0) {
            this.slingshotTimer -= dt;
            if (this.slingshotTimer <= 0) this.slingshotParams = null;
        }
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
        const config = CONFIG.POWERUP.TYPES[type];
        if (!config) return;

        this.activeEffects = this.activeEffects.filter(e => {
            if (e.type === type) {
                this._removeEffect(e);
                return false;
            }
            return true;
        });

        const effect = { type, remaining: config.duration };
        this.activeEffects.push(effect);

        switch (type) {
            case 'SPEED_UP':
                this.baseSpeed = CONFIG.PLAYER.SPEED * config.multiplier;
                this.speed = this.baseSpeed;
                break;
            case 'SLOW_DOWN':
                this.baseSpeed = CONFIG.PLAYER.SPEED * config.multiplier;
                this.speed = this.baseSpeed;
                break;
            case 'THICK':
                this.trail.setWidth(config.trailWidth);
                break;
            case 'THIN':
                this.trail.setWidth(config.trailWidth);
                break;
            case 'SHIELD':
                this.hasShield = true;
                break;
            case 'GHOST':
                this.isGhost = true;
                break;
            case 'INVERT':
                this.invertControls = true;
                break;
        }
    }

    _removeEffect(effect) {
        switch (effect.type) {
            case 'SPEED_UP':
            case 'SLOW_DOWN':
                this.baseSpeed = CONFIG.PLAYER.SPEED;
                this.speed = this.baseSpeed;
                break;
            case 'THICK':
            case 'THIN':
                this.trail.resetWidth();
                break;
            case 'SHIELD':
                this.hasShield = false;
                break;
            case 'GHOST':
                this.isGhost = false;
                break;
            case 'INVERT':
                this.invertControls = false;
                break;
        }
    }

    addToInventory(type) {
        if (this.inventory.length < CONFIG.POWERUP.MAX_INVENTORY) {
            this.inventory.push(type);
            return true;
        }
        return false;
    }

    cycleItem() {
        if (this.inventory.length > 0) {
            this.selectedItemIndex = (this.selectedItemIndex + 1) % this.inventory.length;
        } else {
            this.selectedItemIndex = 0;
        }
    }

    useItem() {
        if (this.inventory.length > 0 && this.selectedItemIndex < this.inventory.length) {
            const type = this.inventory.splice(this.selectedItemIndex, 1)[0];
            if (this.selectedItemIndex >= this.inventory.length && this.inventory.length > 0) {
                this.selectedItemIndex = 0;
            }
            this.applyPowerup(type);
            return type;
        }
        return null;
    }

    dropItem() {
        if (this.inventory.length > 0) {
            return this.inventory.pop();
        }
        return null;
    }

    kill() {
        this.alive = false;
        this.group.visible = false;
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
