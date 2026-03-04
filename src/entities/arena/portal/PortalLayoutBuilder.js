import * as THREE from 'three';
import { CONFIG } from '../../../core/Config.js';
import {
    createBoostPortalMesh,
    createPortalMesh,
    createSlingshotGateMesh,
} from '../PortalGateMeshFactory.js';
import {
    getMapPlanarAnchors,
    getMapPortalSlots3D,
    portalPositionFromSlot,
    resolvePlanarElevatorPair,
    resolvePortalPosition,
} from '../PortalPlacementOps.js';

function asFiniteNumber(value, defaultValue = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
}

function asPositiveNumber(value, defaultValue = 1) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : defaultValue;
}

export class PortalLayoutBuilder {
    constructor(arena) {
        this.arena = arena;
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

        const posA = resolvePortalPosition(new THREE.Vector3(ax * scale, ay * scale, az * scale), 11, this.arena, CONFIG.PORTAL);
        const posB = resolvePortalPosition(new THREE.Vector3(bx * scale, by * scale, bz * scale), 29, this.arena, CONFIG.PORTAL);
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
        const slots = getMapPortalSlots3D(this.arena.currentMapKey);
        if (slots.length < 2) return;

        for (let i = 0; i < pairCount; i++) {
            const slotA = slots[(i * 2) % slots.length];
            const slotB = slots[(i * 2 + 5) % slots.length];
            const slotBAlt = slots[(i * 2 + 7) % slots.length];

            const posA = portalPositionFromSlot(slotA, i * 13 + 5, this.arena, CONFIG.PORTAL);
            let posB = portalPositionFromSlot(slotB, i * 17 + 9, this.arena, CONFIG.PORTAL);
            if (posA.distanceToSquared(posB) < 64) {
                posB = portalPositionFromSlot(slotBAlt, i * 23 + 3, this.arena, CONFIG.PORTAL);
            }

            this._addPortalInstance(posA, posB, colors[i % colors.length], 'NEUTRAL', 'NEUTRAL');
        }
    }

    _buildFixedPlanarPortals(pairCount) {
        const colors = [0x00ffcc, 0xff00cc, 0xffff00, 0x00ccff, 0xff8844, 0x66ff44];
        const anchors = getMapPlanarAnchors(this.arena.currentMapKey);
        const levels = this.getPortalLevels();
        if (anchors.length === 0 || levels.length < 2) return;

        const transitionCount = levels.length - 1;
        for (let i = 0; i < pairCount; i++) {
            const anchor = anchors[i % anchors.length];
            const levelBand = (i + Math.floor(i / Math.max(1, anchors.length))) % transitionCount;
            const lowY = levels[levelBand];
            const highY = levels[levelBand + 1];
            const pair = resolvePlanarElevatorPair(anchor[0], anchor[1], lowY, highY, i * 29 + 7, this.arena, CONFIG.PORTAL);
            if (!pair) continue;
            this._addPortalInstance(pair.low, pair.high, colors[i % colors.length], 'UP', 'DOWN');
        }
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

    _validatePortalPlacements() {
        const minDistSq = 16;
        for (let i = 0; i < this.arena.portals.length; i++) {
            for (let j = i + 1; j < this.arena.portals.length; j++) {
                const a = this.arena.portals[i];
                const b = this.arena.portals[j];
                if (a.posA.distanceToSquared(b.posA) < minDistSq
                    || a.posA.distanceToSquared(b.posB) < minDistSq
                    || a.posB.distanceToSquared(b.posA) < minDistSq
                    || a.posB.distanceToSquared(b.posB) < minDistSq) {
                    // Portals too close; currently tolerated.
                }
            }
        }
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
}
