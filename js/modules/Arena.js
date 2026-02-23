// ============================================
import * as THREE from 'three';
import { CONFIG } from './Config.js';

// Statische Normalen-Vektoren fuer Arena-Wandkollisionen (readonly, einmalig alloziert)
const NORMAL_PX = Object.freeze(new THREE.Vector3(1, 0, 0));   // +X (rechte Wand)
const NORMAL_NX = Object.freeze(new THREE.Vector3(-1, 0, 0));  // -X (linke Wand)
const NORMAL_PY = Object.freeze(new THREE.Vector3(0, 1, 0));   // +Y (Boden)
const NORMAL_NY = Object.freeze(new THREE.Vector3(0, -1, 0));  // -Y (Decke)
const NORMAL_PZ = Object.freeze(new THREE.Vector3(0, 0, 1));   // +Z (hintere Wand)
const NORMAL_NZ = Object.freeze(new THREE.Vector3(0, 0, -1));  // -Z (vordere Wand)

// Helper functions for parsing config values
function asFiniteNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

function asPositiveNumber(value, defaultValue = 1) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : defaultValue;
}

export class Arena {
    constructor(renderer) {
        this.renderer = renderer;
        this.obstacles = [];
        this.portals = [];
        this.specialGates = [];
        this.portalsEnabled = true;
        this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
        this._tmpSphere = new THREE.Sphere();  // Wiederverwendbar fuer Kollision
        // Hilfsvektoren fuer checkSpecialGates (hochfrequent, vermeidet GC)
        this._tmpVecGate1 = new THREE.Vector3();
        this._tmpVecGate2 = new THREE.Vector3();
        // Hilfsvektor fuer lookAt in _buildSpecialGates
        this._tmpVec = new THREE.Vector3();
    }

    /** Baut die Arena fuer die gewaehlte Map */
    build(mapKey) {
        const fallbackMap = CONFIG.MAPS.standard || Object.values(CONFIG.MAPS || {})[0] || {
            name: 'Fallback Map',
            size: [80, 30, 80],
            obstacles: [],
            portals: [],
        };
        const hasRequestedMap = typeof mapKey === 'string' && !!CONFIG.MAPS[mapKey];
        const map = hasRequestedMap ? CONFIG.MAPS[mapKey] : fallbackMap;
        this.currentMapKey = hasRequestedMap ? mapKey : 'standard';
        const scale = CONFIG.ARENA.MAP_SCALE || 1;
        const fallbackSize = Array.isArray(fallbackMap.size) ? fallbackMap.size : [80, 30, 80];
        const mapSize = Array.isArray(map.size) ? map.size : fallbackSize;
        const baseSx = Number.isFinite(mapSize[0]) && mapSize[0] > 0 ? mapSize[0] : fallbackSize[0];
        const baseSy = Number.isFinite(mapSize[1]) && mapSize[1] > 0 ? mapSize[1] : fallbackSize[1];
        const baseSz = Number.isFinite(mapSize[2]) && mapSize[2] > 0 ? mapSize[2] : fallbackSize[2];
        const sx = baseSx * scale;
        const sy = baseSy * scale;
        const sz = baseSz * scale;
        const halfX = sx / 2;
        const halfY = sy / 2;
        const halfZ = sz / 2;

        this.bounds = {
            minX: -halfX, maxX: halfX,
            minY: 0, maxY: sy,
            minZ: -halfZ, maxZ: halfZ,
        };

        // Material
        const checkerTexture = this._createCheckerTexture(
            CONFIG.ARENA.CHECKER_LIGHT_COLOR,
            CONFIG.ARENA.CHECKER_DARK_COLOR
        );
        const checkerWorldSize = Math.max(1, CONFIG.ARENA.CHECKER_WORLD_SIZE || 18);

        const floorTexture = checkerTexture;
        floorTexture.needsUpdate = true;
        floorTexture.repeat.set(
            Math.max(1, sx / checkerWorldSize),
            Math.max(1, sz / checkerWorldSize)
        );

        const wallTexture = checkerTexture.clone();
        wallTexture.needsUpdate = true;
        wallTexture.repeat.set(
            Math.max(1, sx / checkerWorldSize),
            Math.max(1, sy / checkerWorldSize)
        );

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: wallTexture,
            transparent: true,
            opacity: 0.9,
            roughness: 0.75,
            metalness: 0.1,
            side: THREE.DoubleSide,
        });

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: floorTexture,
            roughness: 0.9,
            metalness: 0.05,
        });

        const obstacleMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a4a,
            roughness: 0.4,
            metalness: 0.5,
            transparent: true,
            opacity: 0.6,
        });
        const foamObstacleMat = new THREE.MeshStandardMaterial({
            color: 0x2b5a49,
            roughness: 0.55,
            metalness: 0.15,
            transparent: true,
            opacity: 0.42,
        });

        // ---- Boden ----
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(sx, sz),
            floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.matrixAutoUpdate = false;
        floor.updateMatrix();
        this.renderer.addToScene(floor);

        // ---- Waende ----
        const t = CONFIG.ARENA.WALL_THICKNESS * scale;

        this._addWall(0, halfY, halfZ + t / 2, sx + 2 * t, sy, t, wallMat);
        this._addWall(0, halfY, -halfZ - t / 2, sx + 2 * t, sy, t, wallMat);
        this._addWall(-halfX - t / 2, halfY, 0, t, sy, sz, wallMat);
        this._addWall(halfX + t / 2, halfY, 0, t, sy, sz, wallMat);
        this._addWall(0, sy, 0, sx, t, sz, wallMat);

        // ---- Hindernisse ----
        const obstacleDefs = Array.isArray(map.obstacles) ? map.obstacles : [];
        for (const obs of obstacleDefs) {
            if (!obs || !Array.isArray(obs.pos) || !Array.isArray(obs.size)) continue;
            const px = Number(obs.pos[0]);
            const py = Number(obs.pos[1]);
            const pz = Number(obs.pos[2]);
            const ox = Number(obs.size[0]);
            const oy = Number(obs.size[1]);
            const oz = Number(obs.size[2]);
            if (![px, py, pz, ox, oy, oz].every(Number.isFinite)) continue;
            if (ox <= 0 || oy <= 0 || oz <= 0) continue;
            const obstacleKind = String(obs.kind || 'hard').toLowerCase();
            const isFoamObstacle = obstacleKind === 'foam';
            this._addObstacle(
                px * scale,
                py * scale,
                pz * scale,
                ox * scale,
                oy * scale,
                oz * scale,
                isFoamObstacle ? foamObstacleMat : obstacleMat,
                {
                    kind: isFoamObstacle ? 'foam' : 'hard',
                    edgeColor: isFoamObstacle ? 0x3ddc97 : 0x4466aa,
                    edgeOpacity: isFoamObstacle ? 0.42 : 0.5,
                }
            );
        }

        // ---- Portale ----
        this._buildPortals(map, scale);

        // ---- Spezial-Gates (Upgrade Lab) ----
        this._buildSpecialGates(map, scale);

        // ---- Umgebungseffekte ----
        this._addParticles(sx, sy, sz);
    }

    _buildSpecialGates(map, scale) {
        this.specialGates = [];
        if (!Array.isArray(map.gates)) return;

        for (const gateDef of map.gates) {
            if (!gateDef || !Array.isArray(gateDef.pos)) continue;

            const pos = new THREE.Vector3(
                asFiniteNumber(gateDef.pos[0]) * scale,
                asFiniteNumber(gateDef.pos[1]) * scale,
                asFiniteNumber(gateDef.pos[2]) * scale
            );

            const rotation = new THREE.Euler(
                (asFiniteNumber(gateDef.rot?.[0]) * Math.PI) / 180,
                (asFiniteNumber(gateDef.rot?.[1]) * Math.PI) / 180,
                (asFiniteNumber(gateDef.rot?.[2]) * Math.PI) / 180
            );

            const forward = new THREE.Vector3(0, 0, 1);
            if (Array.isArray(gateDef.forward)) {
                forward.set(gateDef.forward[0], gateDef.forward[1], gateDef.forward[2]).normalize();
            } else {
                forward.applyEuler(rotation).normalize();
            }

            const up = new THREE.Vector3(0, 1, 0);
            if (Array.isArray(gateDef.up)) {
                up.set(gateDef.up[0], gateDef.up[1], gateDef.up[2]).normalize();
            } else {
                up.applyEuler(rotation).normalize();
            }

            const type = String(gateDef.type || 'boost').toLowerCase();
            const color = Number.isFinite(gateDef.color) ? gateDef.color : (type === 'boost' ? 0xffb34d : 0x7dfbff);

            let mesh;
            if (type === 'boost') {
                mesh = this._createBoostPortalMesh(pos, rotation, color);
            } else if (type === 'slingshot') {
                mesh = this._createSlingshotGateMesh(pos, rotation, color);
            }

            if (mesh) {
                if (Array.isArray(gateDef.forward)) {
                    this._tmpVec.copy(pos).add(forward);
                    mesh.lookAt(this._tmpVec);
                    if (Array.isArray(gateDef.up)) {
                        mesh.up.set(gateDef.up[0], gateDef.up[1], gateDef.up[2]);
                        mesh.lookAt(this._tmpVec);
                    }
                }

                this.specialGates.push({
                    type,
                    pos,
                    rotation,
                    quaternion: mesh.quaternion.clone(),
                    forward,
                    up,
                    mesh,
                    radius: asPositiveNumber(gateDef.radius, type === 'boost' ? 3.25 : 2.9) * scale,
                    cooldowns: new Map(),
                    params: gateDef.params || {}
                });
            }
        }
    }

    _createBoostPortalMesh(position, rotation, color) {
        const group = new THREE.Group();

        const ringMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0,
            roughness: 0.25,
            metalness: 0.65,
        });
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xfff0a8,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
        });

        const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.22, 12, 48), ringMat);
        group.add(outerRing);

        const innerDisk = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.95, 40, 1), innerMat);
        group.add(innerDisk);

        const spines = [];
        const spineGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6);
        const spineMat = new THREE.MeshBasicMaterial({ color: 0xffd17c, transparent: true, opacity: 0.65 });
        for (let i = 0; i < 6; i++) {
            const spine = new THREE.Mesh(spineGeo, spineMat);
            const angle = (Math.PI * 2 * i) / 6;
            spine.position.set(Math.cos(angle) * 1.75, Math.sin(angle) * 1.75, 0);
            spine.rotation.z = angle;
            spine.rotation.x = Math.PI / 2;
            group.add(spine);
            spines.push(spine);
        }

        group.userData.spines = spines;
        group.userData.outerRing = outerRing;
        group.userData.innerDisk = innerDisk;

        group.position.copy(position);
        group.quaternion.setFromEuler(rotation);
        this.renderer.addToScene(group);
        return group;
    }

    _createSlingshotGateMesh(position, rotation, color) {
        const group = new THREE.Group();

        const ringMatA = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.95,
            roughness: 0.3,
            metalness: 0.6,
        });
        const ringMatB = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: color,
            emissiveIntensity: 0.6,
            roughness: 0.4,
            metalness: 0.45,
        });

        const frontRing = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.12, 10, 44), ringMatA);
        frontRing.position.z = 0.55;
        group.add(frontRing);

        const backRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 10, 36), ringMatB);
        backRing.position.z = -0.55;
        group.add(backRing);

        const axisBeam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 2.1, 8),
            new THREE.MeshBasicMaterial({ color: 0xa7fcff, transparent: true, opacity: 0.25 }),
        );
        axisBeam.rotation.x = Math.PI / 2;
        group.add(axisBeam);

        group.userData.frontRing = frontRing;
        group.userData.backRing = backRing;
        group.userData.axisBeam = axisBeam;

        group.position.copy(position);
        group.quaternion.setFromEuler(rotation);
        this.renderer.addToScene(group);
        return group;
    }

    _buildPortals(map, scale) {
        this.portals = [];
        if (!this.portalsEnabled) return;

        const pairCount = Math.max(0, Math.floor(CONFIG.GAMEPLAY.PORTAL_COUNT || 0));
        if (pairCount > 0) {
            this._buildFixedDynamicPortals(pairCount);
            return;
        }

        if (Array.isArray(map.portals)) {
            for (const def of map.portals) {
                this._createPortalFromDef(def, scale);
            }
        }

        this._validatePortalPlacements();
    }

    _createPortalFromDef(def, scale) {
        if (!def || !Array.isArray(def.a) || !Array.isArray(def.b)) return;
        const ax = Number(def.a[0]);
        const ay = Number(def.a[1]);
        const az = Number(def.a[2]);
        const bx = Number(def.b[0]);
        const by = Number(def.b[1]);
        const bz = Number(def.b[2]);
        if (![ax, ay, az, bx, by, bz].every(Number.isFinite)) return;

        const posA = this._resolvePortalPosition(
            new THREE.Vector3(ax * scale, ay * scale, az * scale),
            11
        );
        const posB = this._resolvePortalPosition(
            new THREE.Vector3(bx * scale, by * scale, bz * scale),
            29
        );
        const color = Number.isFinite(def.color) ? def.color : 0x00ffcc;
        this._addPortalInstance(posA, posB, color, 'NEUTRAL', 'NEUTRAL');
    }

    _buildFixedDynamicPortals(pairCount) {
        if (CONFIG.GAMEPLAY.PLANAR_MODE) {
            this._buildFixedPlanarPortals(pairCount);
        } else {
            this._buildFixed3DPortals(pairCount);
        }
    }

    _buildFixed3DPortals(pairCount) {
        const colors = [0x00ffcc, 0xff00cc, 0xffff00, 0x00ccff, 0xff8844, 0x66ff44];
        const slots = this._getMapPortalSlots3D();
        if (slots.length < 2) return;

        for (let i = 0; i < pairCount; i++) {
            const slotA = slots[(i * 2) % slots.length];
            const slotB = slots[(i * 2 + 5) % slots.length];
            const slotBAlt = slots[(i * 2 + 7) % slots.length];

            const posA = this._portalPositionFromSlot(slotA, i * 13 + 5);
            let posB = this._portalPositionFromSlot(slotB, i * 17 + 9);
            if (posA.distanceToSquared(posB) < 64) {
                posB = this._portalPositionFromSlot(slotBAlt, i * 23 + 3);
            }

            this._addPortalInstance(posA, posB, colors[i % colors.length], 'NEUTRAL', 'NEUTRAL');
        }
    }

    _buildFixedPlanarPortals(pairCount) {
        const colors = [0x00ffcc, 0xff00cc, 0xffff00, 0x00ccff, 0xff8844, 0x66ff44];
        const anchors = this._getMapPlanarAnchors();
        const levels = this.getPortalLevelsFallback();
        if (anchors.length === 0 || levels.length < 2) return;

        const transitionCount = levels.length - 1;
        for (let i = 0; i < pairCount; i++) {
            const anchor = anchors[i % anchors.length];
            const levelBand = (i + Math.floor(i / Math.max(1, anchors.length))) % transitionCount;
            const lowY = levels[levelBand];
            const highY = levels[levelBand + 1];
            const pair = this._resolvePlanarElevatorPair(anchor[0], anchor[1], lowY, highY, i * 29 + 7);
            if (!pair) continue;

            this._addPortalInstance(pair.low, pair.high, colors[i % colors.length], 'UP', 'DOWN');
        }
    }

    _getMapPortalSlots3D() {
        const layouts = {
            standard: [
                [-0.75, 0.18, -0.75], [0.75, 0.18, 0.75], [0.75, 0.35, -0.75], [-0.75, 0.35, 0.75],
                [-0.2, 0.52, -0.82], [0.2, 0.52, 0.82], [-0.82, 0.62, 0.2], [0.82, 0.62, -0.2],
                [0, 0.26, -0.35], [0, 0.58, 0.35], [-0.45, 0.72, 0], [0.45, 0.72, 0],
            ],
            empty: [
                [-0.78, 0.2, -0.78], [0.78, 0.2, 0.78], [0.78, 0.2, -0.78], [-0.78, 0.2, 0.78],
                [0, 0.45, -0.82], [0, 0.45, 0.82], [-0.82, 0.45, 0], [0.82, 0.45, 0],
                [-0.35, 0.72, -0.35], [0.35, 0.72, 0.35], [0.35, 0.72, -0.35], [-0.35, 0.72, 0.35],
            ],
            maze: [
                [-0.8, 0.22, -0.6], [0.8, 0.22, 0.6], [-0.8, 0.22, 0.6], [0.8, 0.22, -0.6],
                [-0.25, 0.5, -0.8], [0.25, 0.5, 0.8], [-0.6, 0.62, 0], [0.6, 0.62, 0],
                [0, 0.35, -0.2], [0, 0.35, 0.2], [-0.4, 0.75, -0.35], [0.4, 0.75, 0.35],
            ],
            complex: [
                [-0.82, 0.2, -0.82], [0.82, 0.2, 0.82], [0.82, 0.2, -0.82], [-0.82, 0.2, 0.82],
                [-0.5, 0.42, -0.1], [0.5, 0.42, 0.1], [-0.1, 0.55, 0.5], [0.1, 0.55, -0.5],
                [0, 0.72, -0.72], [0, 0.72, 0.72], [-0.72, 0.72, 0], [0.72, 0.72, 0],
            ],
            pyramid: [
                [-0.78, 0.18, -0.78], [0.78, 0.18, 0.78], [0.78, 0.18, -0.78], [-0.78, 0.18, 0.78],
                [-0.45, 0.38, -0.45], [0.45, 0.38, 0.45], [0, 0.58, -0.78], [0, 0.58, 0.78],
                [-0.78, 0.58, 0], [0.78, 0.58, 0], [-0.2, 0.78, 0], [0.2, 0.78, 0],
            ],
        };
        return layouts[this.currentMapKey] || layouts.standard;
    }

    _getMapPlanarAnchors() {
        const anchors = {
            standard: [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0, -0.45], [0, 0.45], [-0.45, 0], [0.45, 0]],
            empty: [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [0, -0.55], [0, 0.55], [-0.55, 0], [0.55, 0]],
            maze: [[-0.78, -0.62], [0.78, -0.62], [0.78, 0.62], [-0.78, 0.62], [0, -0.72], [0, 0.72], [-0.52, 0], [0.52, 0]],
            complex: [[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82], [-0.55, 0], [0.55, 0], [0, -0.55], [0, 0.55]],
            pyramid: [[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78], [-0.48, 0], [0.48, 0], [0, -0.48], [0, 0.48]],
        };
        return anchors[this.currentMapKey] || anchors.standard;
    }

    _portalPositionFromSlot(slot, seed) {
        const b = this.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const nx = (slot[0] + 1) * 0.5;
        const ny = slot[1];
        const nz = (slot[2] + 1) * 0.5;
        const pos = new THREE.Vector3(
            b.minX + margin + nx * (b.maxX - b.minX - 2 * margin),
            b.minY + margin + ny * (b.maxY - b.minY - 2 * margin),
            b.minZ + margin + nz * (b.maxZ - b.minZ - 2 * margin)
        );
        return this._resolvePortalPosition(pos, seed);
    }

    _portalPositionFromXZLevel(nx, nz, levelY, seed) {
        const b = this.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const pos = new THREE.Vector3(
            b.minX + margin + (nx + 1) * 0.5 * (b.maxX - b.minX - 2 * margin),
            levelY,
            b.minZ + margin + (nz + 1) * 0.5 * (b.maxZ - b.minZ - 2 * margin)
        );
        return this._resolvePortalPosition(pos, seed);
    }

    _resolvePlanarElevatorPair(nx, nz, yLow, yHigh, seed = 0) {
        const lowY = Math.min(yLow, yHigh);
        const highY = Math.max(yLow, yHigh);
        const b = this.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const testRadius = CONFIG.PORTAL.RADIUS * 0.75;

        const baseX = b.minX + margin + (nx + 1) * 0.5 * (b.maxX - b.minX - 2 * margin);
        const baseZ = b.minZ + margin + (nz + 1) * 0.5 * (b.maxZ - b.minZ - 2 * margin);

        const lowProbe = new THREE.Vector3();
        const highProbe = new THREE.Vector3();
        for (let i = 0; i < 28; i++) {
            const angle = (((seed + i * 41) % 360) * Math.PI) / 180;
            const dist = i === 0 ? 0 : 2.2 + (i - 1) * 1.2;
            const x = Math.max(b.minX + margin, Math.min(b.maxX - margin, baseX + Math.cos(angle) * dist));
            const z = Math.max(b.minZ + margin, Math.min(b.maxZ - margin, baseZ + Math.sin(angle) * dist));

            lowProbe.set(x, lowY, z);
            highProbe.set(x, highY, z);
            if (!this.checkCollision(lowProbe, testRadius) && !this.checkCollision(highProbe, testRadius)) {
                return {
                    low: lowProbe.clone(),
                    high: highProbe.clone(),
                };
            }
        }

        const lowFallback = this._resolvePortalPosition(new THREE.Vector3(baseX, lowY, baseZ), seed);
        const highAtLowXZ = new THREE.Vector3(lowFallback.x, highY, lowFallback.z);
        if (!this.checkCollision(highAtLowXZ, testRadius)) {
            return {
                low: lowFallback,
                high: highAtLowXZ,
            };
        }

        const highFallback = this._resolvePortalPosition(new THREE.Vector3(baseX, highY, baseZ), seed + 17);
        const lowAtHighXZ = new THREE.Vector3(highFallback.x, lowY, highFallback.z);
        if (!this.checkCollision(lowAtHighXZ, testRadius)) {
            return {
                low: lowAtHighXZ,
                high: highFallback,
            };
        }

        return null;
    }

    _resolvePortalPosition(pos, seed = 0) {
        const b = this.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const testRadius = CONFIG.PORTAL.RADIUS * 0.75;
        if (!this.checkCollision(pos, testRadius)) {
            return pos;
        }

        const probe = new THREE.Vector3();
        for (let i = 0; i < 20; i++) {
            const angle = (((seed + i * 37) % 360) * Math.PI) / 180;
            const dist = 2.5 + i * 1.3;
            const yShift = ((i % 5) - 2) * 1.1;
            probe.set(
                pos.x + Math.cos(angle) * dist,
                pos.y + yShift,
                pos.z + Math.sin(angle) * dist
            );

            probe.x = Math.max(b.minX + margin, Math.min(b.maxX - margin, probe.x));
            probe.y = Math.max(b.minY + margin, Math.min(b.maxY - margin, probe.y));
            probe.z = Math.max(b.minZ + margin, Math.min(b.maxZ - margin, probe.z));

            if (!this.checkCollision(probe, testRadius)) {
                return probe.clone();
            }
        }

        return pos;
    }

    _addPortalInstance(posA, posB, color, dirA = 'NEUTRAL', dirB = 'NEUTRAL') {
        const meshA = this._createPortalMesh(posA, color, dirA);
        const meshB = this._createPortalMesh(posB, color, dirB);

        this.portals.push({
            posA, posB,
            meshA, meshB,
            color,
            cooldowns: new Map(),
        });
    }

    _createPortalMesh(position, color, direction = 'NEUTRAL') {
        const group = new THREE.Group();
        const ringSize = CONFIG.PORTAL.RING_SIZE;

        let displayColor = color;
        if (direction === 'UP') displayColor = 0x00ff00;
        if (direction === 'DOWN') displayColor = 0xff0000;

        const torusGeo = new THREE.TorusGeometry(ringSize, 0.3, 16, 32);
        const torusMat = new THREE.MeshStandardMaterial({
            color: displayColor,
            emissive: displayColor,
            emissiveIntensity: 1.2,
            roughness: 0.2,
            metalness: 0.8,
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        group.add(torus);

        const discGeo = new THREE.CircleGeometry(ringSize * 0.85, 32);
        const discMat = new THREE.MeshBasicMaterial({
            color: displayColor,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        group.add(disc);

        const innerTorusGeo = new THREE.TorusGeometry(ringSize * 0.6, 0.15, 12, 24);
        const innerTorusMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: displayColor,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.6,
        });
        const innerTorus = new THREE.Mesh(innerTorusGeo, innerTorusMat);
        group.add(innerTorus);

        if (direction !== 'NEUTRAL') {
            const arrowGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
            const arrowMat = new THREE.MeshBasicMaterial({
                color: displayColor,
                transparent: true,
                opacity: 0.8,
            });
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);

            if (direction === 'UP') {
                arrow.position.y = 0;
            } else if (direction === 'DOWN') {
                arrow.rotation.x = Math.PI;
                arrow.position.y = 0;
            }

            group.add(arrow);
            group.userData.arrow = arrow;
            group.userData.direction = direction;
        }

        group.position.copy(position);
        this.renderer.addToScene(group);

        return group;
    }

    toggleBeams() {
        // Beams intentionally removed
    }

    /** Prueft ob eine Position ein Portal beruehrt, gibt Zielposition zurueck oder null */
    checkPortal(position, radius, entityId) {
        if (!this.portalsEnabled) return null;

        const triggerRadius = CONFIG.PORTAL.RADIUS;
        const triggerRadiusSq = (triggerRadius + radius) * (triggerRadius + radius);

        for (const portal of this.portals) {
            if (portal.cooldowns.has(entityId) && portal.cooldowns.get(entityId) > 0) {
                continue;
            }

            const distASq = position.distanceToSquared(portal.posA);
            const distBSq = position.distanceToSquared(portal.posB);

            if (distASq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80);
                portal.cooldowns.set(entityId, dynamicCooldown);
                return { target: portal.posB, portal };
            }
            if (distBSq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80);
                portal.cooldowns.set(entityId, dynamicCooldown);
                return { target: portal.posA, portal };
            }
        }

        return null;
    }

    _createCheckerTexture(lightColor, darkColor) {
        const size = 128;
        const half = size / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        const light = `#${lightColor.toString(16).padStart(6, '0')}`;
        const dark = `#${darkColor.toString(16).padStart(6, '0')}`;

        ctx.fillStyle = light;
        ctx.fillRect(0, 0, half, half);
        ctx.fillRect(half, half, half, half);

        ctx.fillStyle = dark;
        ctx.fillRect(half, 0, half, half);
        ctx.fillRect(0, half, half, half);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapLinearFilter;
        return texture;
    }

    _addWall(x, y, z, w, h, d, material) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.renderer.addToScene(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        this.obstacles.push({ mesh, box, isWall: true, kind: 'wall' });
    }

    _addObstacle(x, y, z, w, h, d, material, options = {}) {
        const geo = new THREE.BoxGeometry(w, h, d);

        const edges = new THREE.EdgesGeometry(geo);
        const lineMat = new THREE.LineBasicMaterial({
            color: Number.isFinite(options.edgeColor) ? options.edgeColor : 0x4466aa,
            transparent: true,
            opacity: Number.isFinite(options.edgeOpacity) ? options.edgeOpacity : 0.5,
        });

        const mesh = new THREE.Mesh(geo, material.clone());
        mesh.position.set(x, y, z);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.renderer.addToScene(mesh);

        const line = new THREE.LineSegments(edges, lineMat);
        line.position.copy(mesh.position);
        line.matrixAutoUpdate = false;
        line.updateMatrix();
        this.renderer.addToScene(line);

        const box = new THREE.Box3().setFromObject(mesh);
        this.obstacles.push({
            mesh,
            box,
            isWall: false,
            kind: typeof options.kind === 'string' ? options.kind : 'hard'
        });
    }

    _addParticles(sx, sy, sz) {
        const count = 200;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * sx;
            positions[i * 3 + 1] = Math.random() * sy;
            positions[i * 3 + 2] = (Math.random() - 0.5) * sz;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x4488ff,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(geo, mat);
        this.renderer.addToScene(this.particles);
    }

    /** Prueft Kollision eines Punktes mit Arena-Grenzen und Hindernissen */
    _computeBoxCollisionNormal(box, point) {
        const clampedX = Math.max(box.min.x, Math.min(box.max.x, point.x));
        const clampedY = Math.max(box.min.y, Math.min(box.max.y, point.y));
        const clampedZ = Math.max(box.min.z, Math.min(box.max.z, point.z));

        const normal = new THREE.Vector3(
            point.x - clampedX,
            point.y - clampedY,
            point.z - clampedZ
        );
        if (normal.lengthSq() > 1e-8) {
            return normal.normalize();
        }

        const dMinX = Math.abs(point.x - box.min.x);
        const dMaxX = Math.abs(box.max.x - point.x);
        const dMinY = Math.abs(point.y - box.min.y);
        const dMaxY = Math.abs(box.max.y - point.y);
        const dMinZ = Math.abs(point.z - box.min.z);
        const dMaxZ = Math.abs(box.max.z - point.z);

        let minDist = dMinX;
        normal.set(-1, 0, 0);
        if (dMaxX < minDist) { minDist = dMaxX; normal.set(1, 0, 0); }
        if (dMinY < minDist) { minDist = dMinY; normal.set(0, -1, 0); }
        if (dMaxY < minDist) { minDist = dMaxY; normal.set(0, 1, 0); }
        if (dMinZ < minDist) { minDist = dMinZ; normal.set(0, 0, -1); }
        if (dMaxZ < minDist) { normal.set(0, 0, 1); }
        return normal;
    }

    getCollisionInfo(position, radius) {
        const b = this.bounds;
        if (!position) return null;

        // Optimierung: Statische Normalen-Vektoren statt new THREE.Vector3() pro Aufruf
        if (position.x - radius < b.minX) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_PX };
        if (position.x + radius > b.maxX) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_NX };
        if (position.y - radius < b.minY) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_PY };
        if (position.y + radius > b.maxY) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_NY };
        if (position.z - radius < b.minZ) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_PZ };
        if (position.z + radius > b.maxZ) return { hit: true, kind: 'wall', isWall: true, normal: NORMAL_NZ };

        this._tmpSphere.center.copy(position);
        this._tmpSphere.radius = radius;
        for (const obs of this.obstacles) {
            if (!obs.box.intersectsSphere(this._tmpSphere)) continue;
            return {
                hit: true,
                kind: obs.kind || (obs.isWall ? 'wall' : 'hard'),
                isWall: !!obs.isWall,
                normal: this._computeBoxCollisionNormal(obs.box, position)
            };
        }

        return null;
    }

    /** Prueft ob Spezial-Gates durchflogen wurden */
    checkSpecialGates(position, previousPosition, radius, entityId) {
        if (!this.specialGates || this.specialGates.length === 0) return null;

        // Optimierung: _tmpVecGate1/2 als Instanz-Felder statt new THREE.Vector3() pro Aufruf
        for (const gate of this.specialGates) {
            if (gate.cooldowns.has(entityId) && gate.cooldowns.get(entityId) > 0) {
                continue;
            }

            const distSq = position.distanceToSquared(gate.pos);
            const checkDist = gate.radius + radius;
            if (distSq > checkDist * checkDist) continue;

            this._tmpVecGate1.subVectors(previousPosition, gate.pos);
            this._tmpVecGate2.subVectors(position, gate.pos);

            const dotPrev = this._tmpVecGate1.dot(gate.forward);
            const dotCurr = this._tmpVecGate2.dot(gate.forward);

            if (dotPrev <= 0 && dotCurr > 0) {
                const dynamicCooldown = gate.params.cooldown || 4.0;
                gate.cooldowns.set(entityId, dynamicCooldown);
                return { type: gate.type, forward: gate.forward, up: gate.up, params: gate.params };
            }
        }

        return null;
    }

    checkCollision(position, radius) {
        return !!this.getCollisionInfo(position, radius);
    }

    /** Gibt eine zufaellige freie Position in der Arena zurueck */
    getRandomPosition(margin = 5) {
        const b = this.bounds;
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = b.minX + margin + Math.random() * (b.maxX - b.minX - 2 * margin);
            const y = 3 + Math.random() * (b.maxY - 6);
            const z = b.minZ + margin + Math.random() * (b.maxZ - b.minZ - 2 * margin);
            const pos = new THREE.Vector3(x, y, z);
            if (!this.checkCollision(pos, 3)) {
                return pos;
            }
        }
        const x = b.minX + margin + Math.random() * (b.maxX - b.minX - 2 * margin);
        const y = 3 + Math.random() * (b.maxY - 6);
        const z = b.minZ + margin + Math.random() * (b.maxZ - b.minZ - 2 * margin);
        return new THREE.Vector3(x, y, z);
    }

    getRandomPositionOnLevel(level, margin = 5) {
        const b = this.bounds;
        const y = Number.isFinite(level) ? level : (b.minY + b.maxY) * 0.5;
        for (let attempts = 0; attempts < 50; attempts++) {
            const x = b.minX + margin + Math.random() * (b.maxX - b.minX - 2 * margin);
            const z = b.minZ + margin + Math.random() * (b.maxZ - b.minZ - 2 * margin);
            const pos = new THREE.Vector3(x, y, z);
            if (!this.checkCollision(pos, 3)) {
                return pos;
            }
        }
        const x = b.minX + margin + Math.random() * (b.maxX - b.minX - 2 * margin);
        const z = b.minZ + margin + Math.random() * (b.maxZ - b.minZ - 2 * margin);
        return new THREE.Vector3(x, y, z);
    }

    getPortalLevelsFallback() {
        const b = this.bounds;
        const height = b.maxY - b.minY;
        if (height <= 0) return [b.minY + 3];

        const levels = [];
        const step = Math.max(4, height / 4);
        for (let y = b.minY + step * 0.5; y < b.maxY - 1; y += step) {
            levels.push(Math.round(y * 10) / 10);
        }
        if (levels.length < 2) {
            levels.push(b.minY + 3);
            levels.push(b.maxY - 3);
        }
        return levels;
    }

    getPortalLevels() {
        const b = this.bounds;
        const height = b.maxY - b.minY;
        if (height <= 0) return this.getPortalLevelsFallback();

        const map = CONFIG.MAPS[this.currentMapKey];
        if (map && Array.isArray(map.portalLevels) && map.portalLevels.length >= 2) {
            return map.portalLevels.map(y => Number(y)).filter(Number.isFinite);
        }

        return this.getPortalLevelsFallback();
    }

    update(dt) {
        // Portal-Cooldowns aktualisieren
        for (const portal of this.portals) {
            for (const [id, t] of portal.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    portal.cooldowns.delete(id);
                } else {
                    portal.cooldowns.set(id, newT);
                }
            }
        }

        // Gate-Cooldowns aktualisieren
        for (const gate of this.specialGates) {
            for (const [id, t] of gate.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    gate.cooldowns.delete(id);
                } else {
                    gate.cooldowns.set(id, newT);
                }
            }
        }

        // Portal-Animationen
        const time = performance.now() * 0.001;
        for (const portal of this.portals) {
            if (portal.meshA) portal.meshA.rotation.z = time * 0.5;
            if (portal.meshB) portal.meshB.rotation.z = -time * 0.5;
        }

        // Gate-Animationen
        for (const gate of this.specialGates) {
            if (!gate.mesh) continue;
            const { spines, outerRing, innerDisk, frontRing, backRing } = gate.mesh.userData;
            if (spines) {
                spines.forEach((s, i) => { s.rotation.x = time * 2 + i * 0.5; });
            }
            if (outerRing) outerRing.rotation.z = time * 0.8;
            if (innerDisk) innerDisk.rotation.z = -time * 1.2;
            if (frontRing) frontRing.rotation.z = time * 0.6;
            if (backRing) backRing.rotation.z = -time * 0.9;
        }
    }

    _validatePortalPlacements() {
        const minDistSq = 16;
        for (let i = 0; i < this.portals.length; i++) {
            for (let j = i + 1; j < this.portals.length; j++) {
                const a = this.portals[i];
                const b = this.portals[j];
                if (a.posA.distanceToSquared(b.posA) < minDistSq ||
                    a.posA.distanceToSquared(b.posB) < minDistSq ||
                    a.posB.distanceToSquared(b.posA) < minDistSq ||
                    a.posB.distanceToSquared(b.posB) < minDistSq) {
                    // Portale zu nah beieinander - kein Fehler, nur Logging
                }
            }
        }
    }
}
