import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';
import { disposeObject3DResources } from '../../core/three-disposal.js';
import { createVehicleMesh } from '../vehicle-registry.js';
import { syncPlayerHitboxFromVehicleMesh } from './PlayerMotionOps.js';

const SHARED_GEO = {};

function markSharedGeometry(geometry) {
    if (!geometry) return;
    geometry.userData = geometry.userData || {};
    geometry.userData.__sharedNoDispose = true;
}

function ensureSharedGeo() {
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

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(-1.8, 0.6);
    wingShape.lineTo(-0.3, 0.8);
    wingShape.lineTo(0, 0);
    SHARED_GEO.wingL = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });

    const wingShapeR = new THREE.Shape();
    wingShapeR.moveTo(0, 0);
    wingShapeR.lineTo(1.8, 0.6);
    wingShapeR.lineTo(0.3, 0.8);
    wingShapeR.lineTo(0, 0);
    SHARED_GEO.wingR = new THREE.ExtrudeGeometry(wingShapeR, { depth: 0.06, bevelEnabled: false });

    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0, 0.8);
    finShape.lineTo(0.4, 0.1);
    finShape.lineTo(0, 0);
    SHARED_GEO.fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });

    for (const geo of Object.values(SHARED_GEO)) {
        markSharedGeometry(geo);
    }
}

export class PlayerView {
    constructor(player, renderer) {
        this.player = player;
        this.renderer = renderer;

        this.group = null;
        this.vehicleMesh = null;
        this.shieldMesh = null;
        this.innerShield = null;
        this.firstPersonAnchor = null;
        this.flames = [];

        this._onVehicleLoaded = null;
        this._vehicleLoadedTarget = null;
    }

    createModel() {
        this.group = new THREE.Group();
        this.vehicleMesh = createVehicleMesh(this.player.vehicleId, this.player.color);
        this.group.add(this.vehicleMesh);

        this._attachVehicleLoadedHandler(this.vehicleMesh);

        this.firstPersonAnchor = new THREE.Object3D();
        if (this.vehicleMesh?.firstPersonAnchor) {
            this.firstPersonAnchor = this.vehicleMesh.firstPersonAnchor;
        } else {
            this.firstPersonAnchor.position.set(
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_X || 0,
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_Y || 0,
                CONFIG.PLAYER.NOSE_CAMERA_LOCAL_Z || -2
            );
            this.group.add(this.firstPersonAnchor);
        }

        ensureSharedGeo();
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0,
            wireframe: true,
            side: THREE.BackSide,
            depthWrite: false,
        });
        this.shieldMesh = new THREE.Mesh(SHARED_GEO.shieldBox, shieldMaterial);
        this.innerShield = new THREE.Mesh(
            SHARED_GEO.shieldBox,
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0,
                wireframe: false,
                depthWrite: false,
            })
        );
        this.innerShield.name = 'innerShield';
        this.innerShield.scale.set(0.98, 0.98, 0.98);
        this.shieldMesh.add(this.innerShield);
        this.group.add(this.shieldMesh);

        this._collectFlames();

        if (this.renderer?.addToScene) {
            this.renderer.addToScene(this.group);
        }

        this.applyModelScale();
        this._syncShieldBaseScaleToHitbox();
        this.syncFromState();
        this._syncPlayerRefs();
    }

    _syncPlayerRefs() {
        this.player.group = this.group;
        this.player.vehicleMesh = this.vehicleMesh;
        this.player.shieldMesh = this.shieldMesh;
        this.player.firstPersonAnchor = this.firstPersonAnchor;
        this.player.flames = this.flames;
    }

    _attachVehicleLoadedHandler(mesh) {
        const updateBounds = () => {
            const currentMesh = this.vehicleMesh;
            if (!currentMesh || currentMesh !== mesh || !this.group) return;
            syncPlayerHitboxFromVehicleMesh(this.player, currentMesh);
            this._syncShieldBaseScaleToHitbox();
        };

        if (mesh?.addEventListener) {
            this._onVehicleLoaded = updateBounds;
            this._vehicleLoadedTarget = mesh;
            mesh.addEventListener('loaded', updateBounds);
        }

        updateBounds();
    }

    _collectFlames() {
        this.flames = [];
        this.vehicleMesh?.traverse((child) => {
            if (child.name === 'flame' || (child.material && child.material.name === 'flame')) {
                this.flames.push(child);
            }
        });
    }

    _syncShieldBaseScaleToHitbox() {
        const size = this.player?.hitboxSize;
        const center = this.player?.hitboxCenter;
        if (!size || !center || !this.player?._shieldBaseScale) return;

        this.player._shieldBaseScale.set(
            Math.max(0.12, size.x * 1.15),
            Math.max(0.12, size.y * 1.15),
            Math.max(0.12, size.z * 1.15)
        );

        if (this.shieldMesh) {
            this.shieldMesh.scale.copy(this.player._shieldBaseScale);
            this.shieldMesh.position.copy(center);
        }
    }

    applyModelScale() {
        if (this.group) {
            this.group.scale.setScalar(this.player.modelScale || 1);
            this.group.updateMatrixWorld(true);
        }
    }

    setVisible(visible) {
        if (this.group) {
            this.group.visible = !!visible;
        }
    }

    syncRotation() {
        if (this.group?.quaternion) {
            this.group.quaternion.copy(this.player.quaternion);
            this.group.updateMatrixWorld(true);
        }
    }

    syncFromState() {
        if (!this.group) return;
        this.group.position.copy(this.player.position);
        this.group.quaternion.copy(this.player.quaternion);
    }

    update(dt) {
        if (!this.group) return;

        if (this.player.trail) {
            this.player.trail.update(dt, this.player.position, this.player._tmpVec);
        }

        if (this.vehicleMesh && typeof this.vehicleMesh.tick === 'function') {
            this.vehicleMesh.tick(dt);
        }

        this.syncFromState();

        const time = performance.now() * 0.001;
        if (this.flames.length > 0) {
            const boostFactor = this.player.isBoosting ? 3.0 : 1.0;
            const flicker = Math.sin(time * 25) * 0.15 + Math.sin(time * 37) * 0.1;

            for (let i = 0; i < this.flames.length; i++) {
                const flame = this.flames[i];
                if (!flame) continue;

                const depthOffset = i * 0.05;
                const scaleZ = (0.4 - depthOffset + flicker * (0.3 - depthOffset)) * boostFactor;
                flame.scale.set(1, 1, Math.max(0.1, scaleZ));

                if (flame.material) {
                    flame.material.opacity = this.player.isBoosting ? 1.0 : 0.7;
                    if (this.player.isBoosting) {
                        flame.material.color.setHex(i % 2 === 0 ? 0xffffff : 0xffaa33);
                    } else {
                        flame.material.color.setHex(i % 2 === 0 ? 0xffffaa : 0xff8800);
                    }
                }
            }
        }

        if (this.shieldMesh) {
            this.shieldMesh.visible = this.player.hasShield;
            if (this.player.hasShield) {
                const shieldRatio = Math.max(0, Math.min(1, this.player.shieldHP / Math.max(1, this.player.maxShieldHp || 1)));
                const hitPulse = Math.max(0, Math.min(1, this.player.shieldHitFeedback || 0));
                const flicker = Math.sin(time * 6) * 0.12;
                this.shieldMesh.material.opacity = Math.max(0.08, 0.18 + shieldRatio * 0.24 + hitPulse * 0.32 + flicker);
                this.shieldMesh.scale.copy(this.player._shieldBaseScale).multiplyScalar(
                    Math.max(0.68, 0.9 + shieldRatio * 0.12 - hitPulse * 0.18)
                );
                if (this.innerShield?.material) {
                    this.innerShield.material.opacity = Math.max(
                        0.04,
                        0.08 + shieldRatio * 0.14 + hitPulse * 0.18 + Math.sin(time * 9 + 1.5) * 0.05
                    );
                }
            }
        }

        this.group.updateMatrixWorld(true);
    }

    getFirstPersonCameraAnchor(out = null) {
        const target = out || new THREE.Vector3();
        if (this.firstPersonAnchor) {
            this.firstPersonAnchor.getWorldPosition(target);
            return target;
        }

        this.player.getDirection(this.player._tmpDir);
        return target.copy(this.player.position).add(this.player._tmpDir);
    }

    dispose() {
        if (this._vehicleLoadedTarget?.removeEventListener && this._onVehicleLoaded) {
            this._vehicleLoadedTarget.removeEventListener('loaded', this._onVehicleLoaded);
        }
        this._onVehicleLoaded = null;
        this._vehicleLoadedTarget = null;

        if (this.group) {
            if (this.renderer?.removeFromScene) {
                this.renderer.removeFromScene(this.group);
            }
            disposeObject3DResources(this.group);
        }

        this.vehicleMesh = null;
        this.shieldMesh = null;
        this.innerShield = null;
        this.firstPersonAnchor = null;
        this.flames = [];
        this.group = null;

        this.player.group = null;
        this.player.vehicleMesh = null;
        this.player.shieldMesh = null;
        this.player.firstPersonAnchor = null;
        this.player.flames = [];
    }
}
