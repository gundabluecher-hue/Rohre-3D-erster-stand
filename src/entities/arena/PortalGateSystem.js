import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';
import {
    createBoostPortalMesh,
    createPortalMesh,
    createSlingshotGateMesh,
} from './PortalGateMeshFactory.js';

function asFiniteNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

function asPositiveNumber(value, defaultValue = 1) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : defaultValue;
}

export class PortalGateSystem {
    constructor(arena) {
        this.arena = arena;
        this._tmpVecGate1 = new THREE.Vector3();
        this._tmpVecGate2 = new THREE.Vector3();
        this._tmpVec = new THREE.Vector3();
    }

    build(map, scale) {
        this._buildPortals(map, scale);
        this._buildSpecialGates(map, scale);
    }

    _buildSpecialGates(map, scale) {
        this.arena.specialGates = [];
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
                mesh = createBoostPortalMesh(pos, rotation, color, this.arena.renderer);
            } else if (type === 'slingshot') {
                mesh = createSlingshotGateMesh(pos, rotation, color, this.arena.renderer);
            }

            if (!mesh) continue;

            if (Array.isArray(gateDef.forward)) {
                this._tmpVec.copy(pos).add(forward);
                mesh.lookAt(this._tmpVec);
                if (Array.isArray(gateDef.up)) {
                    mesh.up.set(gateDef.up[0], gateDef.up[1], gateDef.up[2]);
                    mesh.lookAt(this._tmpVec);
                }
            }

            this.arena.specialGates.push({
                type,
                pos,
                rotation,
                quaternion: mesh.quaternion.clone(),
                forward,
                up,
                mesh,
                radius: asPositiveNumber(gateDef.radius, type === 'boost' ? 3.25 : 2.9) * scale,
                cooldowns: new Map(),
                params: gateDef.params || {},
            });
        }
    }

    _buildPortals(map, scale) {
        this.arena.portals = [];
        if (!this.arena.portalsEnabled) return;

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

        const posA = this._resolvePortalPosition(new THREE.Vector3(ax * scale, ay * scale, az * scale), 11);
        const posB = this._resolvePortalPosition(new THREE.Vector3(bx * scale, by * scale, bz * scale), 29);
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
        const levels = this.getPortalLevels();
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
        return layouts[this.arena.currentMapKey] || layouts.standard;
    }

    _getMapPlanarAnchors() {
        const anchors = {
            standard: [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0, -0.45], [0, 0.45], [-0.45, 0], [0.45, 0]],
            empty: [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [0, -0.55], [0, 0.55], [-0.55, 0], [0.55, 0]],
            maze: [[-0.78, -0.62], [0.78, -0.62], [0.78, 0.62], [-0.78, 0.62], [0, -0.72], [0, 0.72], [-0.52, 0], [0.52, 0]],
            complex: [[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82], [-0.55, 0], [0.55, 0], [0, -0.55], [0, 0.55]],
            pyramid: [[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78], [-0.48, 0], [0.48, 0], [0, -0.48], [0, 0.48]],
        };
        return anchors[this.arena.currentMapKey] || anchors.standard;
    }

    _portalPositionFromSlot(slot, seed) {
        const b = this.arena.bounds;
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
        const b = this.arena.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const pos = new THREE.Vector3(
            b.minX + margin + (nx + 1) * 0.5 * (b.maxX - b.minX - 2 * margin),
            levelY,
            b.minZ + margin + (nz + 1) * 0.5 * (b.maxZ - b.minZ - 2 * margin)
        );
        return this._resolvePortalPosition(pos, seed);
    }

    _resolvePlanarElevatorPair(nx, nz, lowY, highY, seed = 0) {
        const b = this.arena.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const baseX = b.minX + margin + (nx + 1) * 0.5 * (b.maxX - b.minX - 2 * margin);
        const baseZ = b.minZ + margin + (nz + 1) * 0.5 * (b.maxZ - b.minZ - 2 * margin);

        const lowProbe = new THREE.Vector3();
        const highProbe = new THREE.Vector3();
        for (let i = 0; i < 28; i++) {
            const angle1 = (((seed + i * 41) % 360) * Math.PI) / 180;
            const dist1 = i === 0 ? 0 : 2.2 + (i - 1) * 1.2;
            const x1 = Math.max(b.minX + margin, Math.min(b.maxX - margin, baseX + Math.cos(angle1) * dist1));
            const z1 = Math.max(b.minZ + margin, Math.min(b.maxZ - margin, baseZ + Math.sin(angle1) * dist1));

            const angle2 = (((seed + 180 + i * 41) % 360) * Math.PI) / 180;
            const dist2 = i === 0 ? 3.0 : 2.2 + i * 1.2;
            const x2 = Math.max(b.minX + margin, Math.min(b.maxX - margin, baseX + Math.cos(angle2) * dist2));
            const z2 = Math.max(b.minZ + margin, Math.min(b.maxZ - margin, baseZ + Math.sin(angle2) * dist2));

            lowProbe.set(x1, lowY, z1);
            highProbe.set(x2, highY, z2);

            if (!this.arena.checkCollision(lowProbe, 2.0) && !this.arena.checkCollision(highProbe, 2.0)) {
                return { low: lowProbe.clone(), high: highProbe.clone() };
            }
        }
        return null;
    }

    _resolvePortalPosition(pos, seed = 0) {
        const b = this.arena.bounds;
        const margin = CONFIG.PORTAL.RING_SIZE + 2.5;
        const testRadius = CONFIG.PORTAL.RADIUS * 0.75;
        if (!this.arena.checkCollision(pos, testRadius)) {
            return pos;
        }

        const probe = new THREE.Vector3();
        for (let i = 0; i < 20; i++) {
            const angle = (((seed + i * 37) % 360) * Math.PI) / 180;
            const dist = 2.5 + i * 1.3;
            probe.set(
                pos.x + Math.cos(angle) * dist,
                pos.y,
                pos.z + Math.sin(angle) * dist
            );

            probe.x = Math.max(b.minX + margin, Math.min(b.maxX - margin, probe.x));
            probe.y = Math.max(b.minY + margin, Math.min(b.maxY - margin, probe.y));
            probe.z = Math.max(b.minZ + margin, Math.min(b.maxZ - margin, probe.z));

            if (!this.arena.checkCollision(probe, testRadius)) {
                return probe.clone();
            }
        }

        return pos;
    }

    _addPortalInstance(posA, posB, color, dirA = 'NEUTRAL', dirB = 'NEUTRAL') {
        const meshA = createPortalMesh(posA, color, dirA, this.arena.renderer);
        const meshB = createPortalMesh(posB, color, dirB, this.arena.renderer);

        this.arena.portals.push({
            posA,
            posB,
            meshA,
            meshB,
            color,
            cooldowns: new Map(),
        });
    }

    checkPortal(position, radius, entityId) {
        if (!this.arena.portalsEnabled) return null;

        const triggerRadius = CONFIG.PORTAL.RADIUS;
        const triggerRadiusSq = (triggerRadius + radius) * (triggerRadius + radius);

        for (const portal of this.arena.portals) {
            if (portal.cooldowns.has(entityId) && portal.cooldowns.get(entityId) > 0) continue;

            const distASq = position.distanceToSquared(portal.posA);
            const distBSq = position.distanceToSquared(portal.posB);

            if (distASq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.min(2.5, Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80));
                portal.cooldowns.set(entityId, dynamicCooldown);
                console.log(`[Arena] PORTAL HIT: Entity ${entityId} teleporting A -> B (Cooldown: ${dynamicCooldown.toFixed(1)}s)`);
                return { target: portal.posB, portal };
            }
            if (distBSq < triggerRadiusSq) {
                const dist = portal.posA.distanceTo(portal.posB);
                const dynamicCooldown = Math.min(2.5, Math.max(CONFIG.PORTAL.COOLDOWN, dist / 80));
                portal.cooldowns.set(entityId, dynamicCooldown);
                console.log(`[Arena] PORTAL HIT: Entity ${entityId} teleporting B -> A (Cooldown: ${dynamicCooldown.toFixed(1)}s)`);
                return { target: portal.posA, portal };
            }
        }

        return null;
    }

    checkSpecialGates(position, previousPosition, radius, entityId) {
        if (!this.arena.specialGates || this.arena.specialGates.length === 0) return null;

        for (const gate of this.arena.specialGates) {
            if (gate.cooldowns.has(entityId) && gate.cooldowns.get(entityId) > 0) continue;

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

    getPortalLevelsFallback() {
        const b = this.arena.bounds;
        const height = b.maxY - b.minY;
        if (height <= 0) return [b.minY + 3];

        const levels = [];
        const levelCount = CONFIG.GAMEPLAY.PLANAR_LEVEL_COUNT || 5;
        const step = height / levelCount;

        for (let i = 0; i < levelCount; i++) {
            levels.push(b.minY + step * i + step * 0.5);
        }

        return levels;
    }

    getPortalLevels() {
        const b = this.arena.bounds;
        const height = b.maxY - b.minY;
        if (height <= 0) return this.getPortalLevelsFallback();

        const map = CONFIG.MAPS[this.arena.currentMapKey];
        if (map && Array.isArray(map.portalLevels) && map.portalLevels.length >= 2) {
            return map.portalLevels.map((y) => Number(y)).filter(Number.isFinite);
        }

        return this.getPortalLevelsFallback();
    }

    update(dt) {
        for (const portal of this.arena.portals) {
            for (const [id, t] of portal.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    portal.cooldowns.delete(id);
                } else {
                    portal.cooldowns.set(id, newT);
                }
            }
        }

        for (const gate of this.arena.specialGates) {
            for (const [id, t] of gate.cooldowns) {
                const newT = t - dt;
                if (newT <= 0) {
                    gate.cooldowns.delete(id);
                } else {
                    gate.cooldowns.set(id, newT);
                }
            }
        }

        const time = performance.now() * 0.001;
        for (const portal of this.arena.portals) {
            if (portal.meshA) portal.meshA.rotation.z = time * 0.5;
            if (portal.meshB) portal.meshB.rotation.z = -time * 0.5;
        }

        for (const gate of this.arena.specialGates) {
            if (!gate.mesh) continue;
            const { spines, outerRing, innerDisk, frontRing, backRing } = gate.mesh.userData;
            if (spines) {
                for (let i = 0; i < spines.length; i++) {
                    spines[i].rotation.x = time * 2 + i * 0.5;
                }
            }
            if (outerRing) outerRing.rotation.z = time * 0.8;
            if (innerDisk) innerDisk.rotation.z = -time * 1.2;
            if (frontRing) frontRing.rotation.z = time * 0.6;
            if (backRing) backRing.rotation.z = -time * 0.9;
        }
    }

    _validatePortalPlacements() {
        const minDistSq = 16;
        for (let i = 0; i < this.arena.portals.length; i++) {
            for (let j = i + 1; j < this.arena.portals.length; j++) {
                const a = this.arena.portals[i];
                const b = this.arena.portals[j];
                if (a.posA.distanceToSquared(b.posA) < minDistSq ||
                    a.posA.distanceToSquared(b.posB) < minDistSq ||
                    a.posB.distanceToSquared(b.posA) < minDistSq ||
                    a.posB.distanceToSquared(b.posB) < minDistSq) {
                    // Portals too close; currently tolerated.
                }
            }
        }
    }
}
