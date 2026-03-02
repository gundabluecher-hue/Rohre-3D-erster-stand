// ============================================
// Powerup.js - Powerup-Spawning & Pickup
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { isHuntHealthActive } from '../hunt/HealthSystem.js';
import { isRocketTierType, pickWeightedRocketTierType } from '../hunt/RocketPickupSystem.js';
import { PowerupModelFactory } from './PowerupModelFactory.js';

export class PowerupManager {
    constructor(renderer, arena) {
        this.renderer = renderer;
        this.arena = arena;
        this.items = []; // { mesh, type, box }
        this.spawnTimer = 0;
        this.typeKeys = Object.keys(CONFIG.POWERUP.TYPES);
        this._pickupBoxSize = new THREE.Vector3();
        this._pickupSphere = new THREE.Sphere();

        // Shared Geometries (einmal erstellen, wiederverwenden)
        const size = CONFIG.POWERUP.SIZE;
        this._modelFactory = new PowerupModelFactory(size);
        this._sharedGeo = new THREE.BoxGeometry(size, size, size);
        this._sharedWireGeo = new THREE.BoxGeometry(size * 1.15, size * 1.15, size * 1.15);
    }

    update(dt) {
        this.spawnTimer += dt;

        // Neue Items spawnen
        if (this.spawnTimer >= CONFIG.POWERUP.SPAWN_INTERVAL && this.items.length < CONFIG.POWERUP.MAX_ON_FIELD) {
            this.spawnTimer = 0;
            this._spawnRandom();
        }

        // Animation
        const time = performance.now() * 0.001;
        const pickupSize = CONFIG.POWERUP.PICKUP_RADIUS * 2;
        this._pickupBoxSize.set(pickupSize, pickupSize, pickupSize);
        for (const item of this.items) {
            item.mesh.rotation.y += CONFIG.POWERUP.ROTATION_SPEED * dt;
            item.mesh.position.y = item.baseY + Math.sin(time * CONFIG.POWERUP.BOUNCE_SPEED + item.phase) * CONFIG.POWERUP.BOUNCE_HEIGHT;

            // Bounding Box aktualisieren
            item.box.setFromCenterAndSize(
                item.mesh.position,
                this._pickupBoxSize
            );
        }
    }

    _spawnRandom() {
        const huntModeActive = isHuntHealthActive();
        const spawnableTypes = this.typeKeys.filter((typeKey) => {
            const entry = CONFIG.POWERUP.TYPES[typeKey];
            if (!entry) return false;
            if (entry.huntOnly && !huntModeActive) return false;
            if (entry.classicOnly && huntModeActive) return false;
            return true;
        });
        if (spawnableTypes.length === 0) return;

        let type = spawnableTypes[Math.floor(Math.random() * spawnableTypes.length)];
        const rocketSpawnChance = Math.max(0, Number(CONFIG?.HUNT?.ROCKET_PICKUP_SPAWN_CHANCE || 0));
        if (huntModeActive && Math.random() < rocketSpawnChance) {
            const weightedRocketType = pickWeightedRocketTierType();
            if (spawnableTypes.includes(weightedRocketType) || isRocketTierType(weightedRocketType)) {
                type = weightedRocketType;
            }
        }

        const config = CONFIG.POWERUP.TYPES[type];
        let pos = null;
        if (CONFIG.GAMEPLAY.PLANAR_MODE && this.arena?.getPortalLevels) {
            const levels = this.arena.getPortalLevels();
            if (levels.length > 0) {
                const level = levels[Math.floor(Math.random() * levels.length)];
                pos = this.arena.getRandomPositionOnLevel(level, 8);
            }
        }
        if (!pos) {
            pos = this.arena.getRandomPosition(8);
        }

        const mesh = this._createPowerupMesh(type, config);
        mesh.position.copy(pos);
        mesh.castShadow = false;

        this.renderer.addToScene(mesh);

        const box = new THREE.Box3().setFromCenterAndSize(
            pos,
            new THREE.Vector3(CONFIG.POWERUP.PICKUP_RADIUS * 2, CONFIG.POWERUP.PICKUP_RADIUS * 2, CONFIG.POWERUP.PICKUP_RADIUS * 2)
        );

        this.items.push({
            mesh,
            type,
            box,
            baseY: pos.y,
            phase: Math.random() * Math.PI * 2,
        });
    }

    _createPowerupMesh(type, config) {
        if (this._modelFactory) {
            const model = this._modelFactory.createModel(type, config);
            if (model) return model;
        }

        const mat = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.5,
            roughness: 0.2,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85,
        });
        const mesh = new THREE.Mesh(this._sharedGeo, mat);

        const wireMat = new THREE.MeshBasicMaterial({
            color: config.color,
            wireframe: true,
            transparent: true,
            opacity: 0.3,
        });
        const wire = new THREE.Mesh(this._sharedWireGeo, wireMat);
        mesh.add(wire);
        return mesh;
    }

    /** Prueft ob ein Spieler ein Item einsammelt */
    checkPickup(playerPosition, radius) {
        this._pickupSphere.center.copy(playerPosition);
        this._pickupSphere.radius = radius + CONFIG.POWERUP.PICKUP_RADIUS;

        for (let i = this.items.length - 1; i >= 0; i--) {
            if (this.items[i].box.intersectsSphere(this._pickupSphere)) {
                const item = this.items.splice(i, 1)[0];
                this.renderer.removeFromScene(item.mesh);
                // Alle Materialien disposen (Parent + Children wie Wireframe)
                item.mesh.traverse((node) => {
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(m => m.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                });
                return item.type;
            }
        }
        return null;
    }

    clear() {
        for (const item of this.items) {
            this.renderer.removeFromScene(item.mesh);
            item.mesh.traverse((node) => {
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(m => m.dispose());
                    } else {
                        node.material.dispose();
                    }
                }
            });
        }
        this.items = [];
        this.spawnTimer = 0;
    }

    dispose() {
        this.clear();
        if (this._modelFactory) {
            this._modelFactory.dispose();
            this._modelFactory = null;
        }
        if (this._sharedGeo) {
            this._sharedGeo.dispose();
            this._sharedGeo = null;
        }
        if (this._sharedWireGeo) {
            this._sharedWireGeo.dispose();
            this._sharedWireGeo = null;
        }
    }
}

