/**
 * OBJ-VEHICLE-MESH.JS - 3D Modell-Loader für OBJ-Schiffe
 * Lädt Modelle aus dem Spaceship-Pack und fügt Triebwerke hinzu.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

export class OBJVehicleMesh extends THREE.Group {
    constructor(color, shipId = 'ship5') {
        super();
        this.playerColor = color;
        this.shipId = shipId;
        this._loaded = false;

        // Materialien
        this.glowMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.6
        });

        this.forceFieldMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });

        this._time = 0;
        this.forceFields = [];
        this.muzzle = new THREE.Object3D();
        this.add(this.muzzle);

        this.loadModel();
    }

    loadModel() {
        const mtlLoader = new MTLLoader();
        const basePath = 'assets/models/jets/cc0/spaceship_pack/dist/obj_mtl/';

        mtlLoader.setPath(basePath);
        mtlLoader.load(`${this.shipId}.mtl`, (materials) => {
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(basePath);
            objLoader.load(`${this.shipId}.obj`, (object) => {
                // Modell zentrieren und skalieren
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                // Modell so ausrichten, dass -Z vorne ist
                object.position.sub(center);

                // Skalierung anpassen
                const targetSize = 4.5;
                const scale = targetSize / Math.max(size.x, size.y, size.z);
                object.scale.setScalar(scale);

                // Speichere die lokale BoundingBox für OBB-Kollisionen
                this.localBox = new THREE.Box3().setFromObject(object);

                // Alle Meshes im Objekt finden
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.add(object);
                this.model = object;

                // Triebwerke hinzufügen (Kompakter & Kleiner)
                this.createWingEngines(
                    size.x * scale * 0.45,
                    size.z * scale,
                    size.x * scale * 0.5,
                    size.z * scale * 0.4
                );

                // Muzzle position anpassen (vor dem Schiff)
                this.muzzle.position.set(0, 0, -size.z * scale * 0.6);

                this._loaded = true;
                this.dispatchEvent({ type: 'loaded' });
            });
        });
    }

    createWingEngines(wingSpan, depth, forceFieldWidth, forceFieldDepth) {
        // Reduzierte Größe (30% kleiner)
        const shroudGeo = new THREE.CylinderGeometry(0.28, 0.24, 1.0, 12);
        shroudGeo.rotateX(Math.PI / 2);

        const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12, 1, true);
        nozzleGeo.rotateX(Math.PI / 2);

        const coreGeo = new THREE.SphereGeometry(0.14, 8, 8);
        const engineCoreMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0
        });

        const createEngineAssembly = (side) => {
            const group = new THREE.Group();
            // Direkt an die Flügelspitzen (reduzierter Offset)
            group.position.set(side * (wingSpan + 0.1), 0, depth * 0.45);

            // Shroud
            const shroud = new THREE.Mesh(shroudGeo, new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 }));
            group.add(shroud);

            // Nozzle
            const nozzle = new THREE.Mesh(nozzleGeo, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.2 }));
            nozzle.position.z = 0.5;
            group.add(nozzle);

            // Core
            const core = new THREE.Mesh(coreGeo, engineCoreMat);
            core.position.z = 0.35;
            group.add(core);

            this.add(group);
            return group;
        };

        const lEng = createEngineAssembly(-1);
        const rEng = createEngineAssembly(1);

        // Force Fields entfernt wie gewünscht

        // Glow / Flame (Skalierung angepasst)
        const glowGeo = new THREE.CylinderGeometry(0.2, 0.01, 1.0, 8);
        glowGeo.rotateX(-Math.PI / 2);

        const addFlame = (parent) => {
            const flame = new THREE.Mesh(glowGeo, this.glowMat.clone());
            flame.name = 'flame';
            flame.position.z = 1.0;
            parent.add(flame);
        };

        addFlame(lEng);
        addFlame(rEng);
    }

    tick(dt) {
        this._time += dt;
        // Kraftfelder sind weg, daher kein Pulsing mehr nötig für forceFields Array
    }
}
