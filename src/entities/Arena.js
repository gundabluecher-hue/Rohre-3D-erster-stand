import * as THREE from 'three';
import { ArenaBuilder } from './arena/ArenaBuilder.js';
import { ArenaCollision } from './arena/ArenaCollision.js';
import { PortalGateSystem } from './arena/PortalGateSystem.js';

export class Arena {
    constructor(renderer) {
        this.renderer = renderer;
        this.obstacles = [];
        this.portals = [];
        this.specialGates = [];
        this.portalsEnabled = true;
        this.currentMapKey = 'standard';
        this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

        this.particles = null;
        this._floorMesh = null;
        this._mergedWallMesh = null;
        this._mergedObstacleMesh = null;
        this._mergedFoamMesh = null;
        this._mergedObstacleEdges = null;
        this._mergedFoamEdges = null;
        this._lastBuildSignature = null;

        this._builder = new ArenaBuilder(this);
        this._collision = new ArenaCollision(this);
        this._portalGateSystem = new PortalGateSystem(this);
    }

    build(mapKey) {
        const buildContext = this._builder.build(mapKey, {
            previousBuildSignature: this._lastBuildSignature,
        });

        if (buildContext.rebuildPolicy !== 'reuse') {
            this._portalGateSystem.build(buildContext.map, buildContext.scale);
            this._builder.compileParticleStage(buildContext.sx, buildContext.sy, buildContext.sz);
            this._lastBuildSignature = buildContext.buildSignature;
        }
    }

    toggleBeams(enabled) {
        // Dummy method when beams are not configured.
    }

    setWallVisibility(visible) {
        if (this._mergedWallMesh) this._mergedWallMesh.visible = visible;
        if (this._mergedObstacleMesh) this._mergedObstacleMesh.visible = visible;
        if (this._mergedFoamMesh) this._mergedFoamMesh.visible = visible;
        if (this._mergedObstacleEdges) this._mergedObstacleEdges.visible = visible;
        if (this._mergedFoamEdges) this._mergedFoamEdges.visible = visible;
    }

    checkPortal(position, radius, entityId) {
        return this._portalGateSystem.checkPortal(position, radius, entityId);
    }

    getCollisionInfo(position, radius) {
        return this._collision.getCollisionInfo(position, radius);
    }

    checkCollisionFast(position, radius = 0) {
        return this._collision.checkCollisionFast(position, radius);
    }

    checkSpecialGates(position, previousPosition, radius, entityId) {
        return this._portalGateSystem.checkSpecialGates(position, previousPosition, radius, entityId);
    }

    checkCollision(position, radius) {
        return this.checkCollisionFast(position, radius);
    }

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
        return this._portalGateSystem.getPortalLevelsFallback();
    }

    getPortalLevels() {
        return this._portalGateSystem.getPortalLevels();
    }

    update(dt) {
        this._portalGateSystem.update(dt);
    }
}
