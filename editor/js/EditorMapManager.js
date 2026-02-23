import * as THREE from 'three';
import { createMapDocument, parseMapJSON } from '../../js/modules/MapSchema.js';

const OBJECT_ID_PREFIX = Object.freeze({
    hard: 'hard',
    foam: 'foam',
    tunnel: 'tunnel',
    portal: 'portal',
    spawn: 'spawn',
    item: 'item',
    aircraft: 'aircraft',
});

function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
}

export class EditorMapManager {
    constructor(core, assetLoader, options = {}) {
        this.core = core;
        this.assetLoader = assetLoader;
        this.callbacks = {
            onTunnelVisualsChanged: null,
            onHudCountChanged: null,
            onBeforeManagedObjectRemoved: null,
            onBeforeManagedObjectsCleared: null
        };

        this.objectsById = new Map();
        this.nextObjectIdCounter = 1;

        this._sceneMutationDepth = 0;
        this._pendingHudRefresh = false;
        this._pendingTunnelVisualRefresh = false;

        this.setCallbacks(options?.callbacks || options);
        this.setupPrimitives();
    }

    setCallbacks(callbacks = {}) {
        if (!callbacks || typeof callbacks !== 'object') return;

        if (typeof callbacks.onTunnelVisualsChanged === 'function') {
            this.callbacks.onTunnelVisualsChanged = callbacks.onTunnelVisualsChanged;
        }
        if (typeof callbacks.onHudCountChanged === 'function') {
            this.callbacks.onHudCountChanged = callbacks.onHudCountChanged;
        }
        if (typeof callbacks.onBeforeManagedObjectRemoved === 'function') {
            this.callbacks.onBeforeManagedObjectRemoved = callbacks.onBeforeManagedObjectRemoved;
        }
        if (typeof callbacks.onBeforeManagedObjectsCleared === 'function') {
            this.callbacks.onBeforeManagedObjectsCleared = callbacks.onBeforeManagedObjectsCleared;
        }
    }

    setupPrimitives() {
        this.blockGeo = new THREE.BoxGeometry(1, 1, 1);
        this.sphereGeo = new THREE.SphereGeometry(1, 16, 16);
        this.cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
        this.torusGeo = new THREE.TorusGeometry(1, 0.3, 16, 32);
        this.torusKnotGeo = new THREE.TorusKnotGeometry(1, 0.3, 64, 8);
        this.coneGeo = new THREE.ConeGeometry(1, 2, 8);

        this.mats = {
            hard: new THREE.MeshLambertMaterial({ color: 0xf97373, transparent: true, opacity: 0.8 }),
            foam: new THREE.MeshLambertMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 }),
            tunnel: new THREE.MeshLambertMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5 }),
            portal: new THREE.MeshLambertMaterial({ color: 0xc084fc }),
            playerSpawn: new THREE.MeshLambertMaterial({ color: 0xeab308 }),
            botSpawn: new THREE.MeshLambertMaterial({ color: 0xef4444 }),
            item_fallback: new THREE.MeshLambertMaterial({ color: 0x64748b }),
            aircraft_fallback: new THREE.MeshLambertMaterial({ color: 0xc084fc })
        };
    }

    beginSceneMutation() {
        this._sceneMutationDepth += 1;
    }

    endSceneMutation() {
        this._sceneMutationDepth = Math.max(0, this._sceneMutationDepth - 1);
        if (this._sceneMutationDepth === 0) {
            this.flushSceneUiRefresh();
        }
    }

    withSceneMutation(fn) {
        this.beginSceneMutation();
        try {
            return fn();
        } finally {
            this.endSceneMutation();
        }
    }

    queueSceneUiRefresh({ tunnelVisuals = false } = {}) {
        this._pendingHudRefresh = true;
        this._pendingTunnelVisualRefresh = this._pendingTunnelVisualRefresh || tunnelVisuals;

        if (this._sceneMutationDepth === 0) {
            this.flushSceneUiRefresh();
        }
    }

    flushSceneUiRefresh() {
        if (this._pendingTunnelVisualRefresh) {
            this.callbacks.onTunnelVisualsChanged?.();
        }
        if (this._pendingHudRefresh) {
            this.callbacks.onHudCountChanged?.();
        }

        this._pendingHudRefresh = false;
        this._pendingTunnelVisualRefresh = false;
    }

    getObjectCount() {
        return this.objectsById.size;
    }

    getObjectById(id) {
        if (typeof id !== 'string') return null;
        return this.objectsById.get(id) || null;
    }

    hasObjectId(id) {
        return this.objectsById.has(id);
    }

    isRegisteredObject(object) {
        if (!object || !object.userData?.id) return false;
        return this.objectsById.get(object.userData.id) === object;
    }

    resolveManagedObject(object) {
        if (!object) return null;

        if (this.isRegisteredObject(object)) {
            return object;
        }

        const objectId = object.userData?.editorObjectId || object.userData?.id;
        if (typeof objectId === 'string') {
            const registered = this.objectsById.get(objectId);
            if (registered) return registered;
        }

        let node = object;
        while (node && node.parent && node.parent !== this.core.objectsContainer) {
            node = node.parent;
        }
        if (node && node.parent === this.core.objectsContainer && this.isRegisteredObject(node)) {
            return node;
        }

        return null;
    }

    normalizeRequestedId(requestedId) {
        if (typeof requestedId !== 'string') return null;
        const normalized = requestedId.trim();
        return normalized.length > 0 ? normalized : null;
    }

    generateObjectId(type) {
        const prefix = OBJECT_ID_PREFIX[type] || 'obj';
        let candidate = '';
        do {
            candidate = `${prefix}_${this.nextObjectIdCounter++}`;
        } while (this.objectsById.has(candidate));
        return candidate;
    }

    allocateObjectId(type, requestedId = null) {
        const normalizedRequestedId = this.normalizeRequestedId(requestedId);
        if (!normalizedRequestedId) {
            return this.generateObjectId(type);
        }

        if (!this.objectsById.has(normalizedRequestedId)) {
            return normalizedRequestedId;
        }

        const replacement = this.generateObjectId(type);
        console.warn(`[EditorMapManager] Duplicate object id "${normalizedRequestedId}" detected. Replaced with "${replacement}".`);
        return replacement;
    }

    markManagedHierarchy(rootObject, objectId) {
        rootObject.traverse((node) => {
            node.userData = {
                ...(node.userData || {}),
                editorObjectId: objectId
            };
        });
        rootObject.userData.editorManagedRoot = true;
    }

    markOwnedResource(resource) {
        if (!resource || typeof resource !== 'object') return resource;
        resource.userData = {
            ...(resource.userData || {}),
            editorOwnedResource: true
        };
        return resource;
    }

    createTunnelTrailMesh(subType) {
        if (typeof subType !== 'string' || !subType.startsWith('trail_')) return null;
        const asset = this.assetLoader?.getClone?.(subType);
        if (!asset) return null;

        // Trail OBJ meshes are modeled along Z; rotate to Y so alignTunnelSegment() can orient/stretch them.
        asset.rotation.x = -Math.PI / 2;

        // Normalize base dimensions so wrapper scaling maps roughly to radius/length semantics.
        if (subType === 'trail_segment') {
            asset.scale.set(1, 1, 0.4);
        } else if (subType === 'trail_arrow') {
            asset.scale.set(0.625, 0.625, 0.2);
        }

        const wrapper = new THREE.Group();
        wrapper.name = `tunnel_${subType}`;
        wrapper.add(asset);
        return wrapper;
    }

    createSelectionOutline(geometry) {
        const outlineGeometry = this.markOwnedResource(new THREE.EdgesGeometry(geometry));
        const outlineMaterial = this.markOwnedResource(new THREE.LineBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.2
        }));

        const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        outline.userData = {
            ...(outline.userData || {}),
            isSelectionOutline: true
        };
        return outline;
    }

    attachSelectionOutlines(object) {
        object.traverse((child) => {
            if (!child?.isMesh || !child.geometry) return;
            child.add(this.createSelectionOutline(child.geometry));
        });
    }

    registerObject(mesh, { requestedId = null, updateUi = true } = {}) {
        if (!mesh) return null;

        const objectType = mesh.userData?.type || 'obj';
        const objectId = this.allocateObjectId(objectType, requestedId ?? mesh.userData?.id);

        mesh.userData = {
            ...(mesh.userData || {}),
            id: objectId,
            editorObjectId: objectId,
            editorManagedRoot: true
        };

        this.markManagedHierarchy(mesh, objectId);
        this.objectsById.set(objectId, mesh);
        this.core.objectsContainer.add(mesh);

        if (updateUi) {
            this.queueSceneUiRefresh({ tunnelVisuals: mesh.userData.type === 'tunnel' });
        }

        return mesh;
    }

    shouldDisposeGeometry(node) {
        return !!(node?.userData?.isSelectionOutline || node?.geometry?.userData?.editorOwnedResource);
    }

    shouldDisposeMaterial(node, material) {
        return !!(node?.userData?.isSelectionOutline || material?.userData?.editorOwnedResource);
    }

    disposeObjectResources(rootObject) {
        if (!rootObject) return;

        const disposedGeometries = new Set();
        const disposedMaterials = new Set();

        rootObject.traverse((node) => {
            if (node.geometry && this.shouldDisposeGeometry(node) && !disposedGeometries.has(node.geometry)) {
                disposedGeometries.add(node.geometry);
                node.geometry.dispose?.();
            }

            const materials = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
            for (const material of materials) {
                if (!material || disposedMaterials.has(material) || !this.shouldDisposeMaterial(node, material)) continue;
                disposedMaterials.add(material);
                material.dispose?.();
            }
        });
    }

    removeObject(object, { updateUi = true } = {}) {
        const rootObject = this.resolveManagedObject(object);
        if (!rootObject) return false;

        const objectId = rootObject.userData?.id;
        const isTunnel = rootObject.userData?.type === 'tunnel';

        this.callbacks.onBeforeManagedObjectRemoved?.(rootObject);

        if (this.core.transformControl.object === rootObject) {
            this.core.transformControl.detach();
        }

        if (rootObject.parent) {
            rootObject.parent.remove(rootObject);
        }

        if (typeof objectId === 'string') {
            this.objectsById.delete(objectId);
        }

        this.disposeObjectResources(rootObject);

        if (updateUi) {
            this.queueSceneUiRefresh({ tunnelVisuals: isTunnel });
        }

        return true;
    }

    clearAllObjects() {
        this.withSceneMutation(() => {
            this.callbacks.onBeforeManagedObjectsCleared?.();

            const objects = [...this.core.objectsContainer.children];
            for (const object of objects) {
                this.removeObject(object, { updateUi: false });
            }

            // Ensure visuals are fully reset even if no tunnel object existed in the registry.
            this.queueSceneUiRefresh({ tunnelVisuals: true });
        });
    }

    notifyObjectMutated(object) {
        const rootObject = this.resolveManagedObject(object);
        if (!rootObject) return null;

        if (rootObject.userData?.type === 'tunnel') {
            this.syncTunnelEndpointsFromMesh(rootObject);
            this.queueSceneUiRefresh({ tunnelVisuals: true });
        }

        return rootObject;
    }

    createMesh(type, subType, x, y, z, sizeInfo, extraProps = {}, options = {}) {
        const props = { ...(extraProps || {}) };
        const requestedId = props.id;
        let mesh = null;
        let userData = { type, sizeInfo, ...props };

        if (type === 'hard' || type === 'foam') {
            mesh = new THREE.Mesh(this.blockGeo, this.mats[type]);
            const fallback = Math.max(10, (Number(sizeInfo) || 70) * 2);
            const sx = Number(props.sizeX) || fallback;
            const sz = Number(props.sizeZ) || fallback;
            const sy = Number(props.sizeY) || fallback;
            mesh.scale.set(sx, sy, sz);
            userData.sizeX = sx;
            userData.sizeZ = sz;
            userData.sizeY = sy;
            userData.sizeInfo = Math.max(sx, sy, sz) * 0.5;
        }
        else if (type === 'tunnel') {
            const trailSubType = (typeof subType === 'string' && subType.startsWith('trail_')) ? subType : null;
            mesh = this.createTunnelTrailMesh(trailSubType) || new THREE.Mesh(this.cylinderGeo, this.mats.tunnel);
            const r = Number(props.radius) || Number(sizeInfo) || 160;
            userData.radius = r;
            if (trailSubType) {
                userData.subType = trailSubType;
            }

            if (props.pointA && props.pointB) {
                this.alignTunnelSegment(mesh, props.pointA, props.pointB, r);
            } else {
                mesh.scale.set(r, 100, r);
            }
        }
        else if (type === 'portal') {
            const portalSubType = (typeof subType === 'string' && subType.startsWith('portal_')) ? subType : null;
            mesh = (portalSubType ? this.assetLoader.getClone(portalSubType) : null) || new THREE.Mesh(this.torusGeo, this.mats.portal);
            const r = Number(sizeInfo) || Number(props.radius) || 80;
            mesh.scale.set(r, r, r);
            mesh.rotation.x = Math.PI / 2;
            userData.sizeInfo = r;
            userData.radius = r;
            if (portalSubType) {
                userData.subType = portalSubType;
            }
        }
        else if (type === 'spawn') {
            mesh = new THREE.Mesh(this.torusKnotGeo, subType === 'player' ? this.mats.playerSpawn : this.mats.botSpawn);
            mesh.scale.set(40, 40, 40);
            userData.subType = subType;
        }
        else if (type === 'item') {
            mesh = this.assetLoader.getClone(subType) || new THREE.Mesh(this.sphereGeo, this.mats.item_fallback);
            mesh.scale.set(50, 50, 50);
            if (subType === 'item_shield' || subType === 'item_coin' || subType === 'item_ring') mesh.scale.set(50, 10, 50);
            if (subType === 'item_capsule' || subType === 'item_rocket') mesh.scale.set(30, 80, 30);
            userData.subType = subType;
        }
        else if (type === 'aircraft') {
            mesh = this.assetLoader.getClone(subType) || new THREE.Mesh(this.coneGeo, this.mats.aircraft_fallback);
            const s = Number(props.modelScale) || 50;
            mesh.scale.set(s, s, s);
            userData.subType = subType;
            userData.modelScale = s;
        }

        if (!mesh) {
            console.warn(`[EditorMapManager] Unsupported mesh type "${type}"`);
            return null;
        }

        mesh.position.set(x, y, z);
        mesh.userData = {
            ...(mesh.userData || {}),
            ...userData
        };

        this.attachSelectionOutlines(mesh);

        if (isFiniteNumber(props.rotateY)) {
            mesh.rotation.y = Number(props.rotateY);
        }

        return this.registerObject(mesh, {
            requestedId,
            updateUi: options.updateUi !== false
        });
    }

    alignTunnelSegment(mesh, pA, pB, radius) {
        const distance = pA.distanceTo(pB);
        if (distance <= 0) return;

        mesh.position.copy(pA).lerp(pB, 0.5);
        mesh.scale.set(radius, distance, radius);
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            pB.clone().sub(pA).normalize()
        );

        mesh.userData = {
            ...(mesh.userData || {}),
            pointA: pA.clone(),
            pointB: pB.clone(),
            radius
        };
    }

    syncTunnelEndpointsFromMesh(mesh) {
        const rootObject = this.resolveManagedObject(mesh) || mesh;
        if (!rootObject || rootObject.userData?.type !== 'tunnel') return;

        const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(rootObject.quaternion).normalize();
        const halfLength = Math.max(0, rootObject.scale.y * 0.5);
        const center = rootObject.position.clone();

        rootObject.userData.pointA = center.clone().addScaledVector(direction, -halfLength);
        rootObject.userData.pointB = center.clone().addScaledVector(direction, halfLength);
        rootObject.userData.radius = rootObject.scale.x || rootObject.userData.radius || 160;
    }

    generateJSONExport(arenaSize) {
        const payload = createMapDocument({
            arenaSize,
            tunnels: [],
            hardBlocks: [],
            foamBlocks: [],
            botSpawns: [],
            portals: [],
            items: [],
            aircraft: [],
            playerSpawn: { x: -800, y: arenaSize.height * 0.55, z: 0 },
        });

        this.core.objectsContainer.children.forEach((obj) => {
            const u = obj.userData || {};
            const p = obj.position;
            const ry = obj.rotation.y || 0;

            if (u.type === 'tunnel') {
                this.syncTunnelEndpointsFromMesh(obj);
            }

            if (u.type === 'hard') {
                payload.hardBlocks.push({
                    id: u.id,
                    x: p.x, y: p.y, z: p.z,
                    width: u.sizeX,
                    depth: u.sizeZ,
                    height: u.sizeY,
                    size: u.sizeInfo,
                    rotateY: ry
                });
            }
            else if (u.type === 'foam') {
                payload.foamBlocks.push({
                    id: u.id,
                    x: p.x, y: p.y, z: p.z,
                    width: u.sizeX,
                    depth: u.sizeZ,
                    height: u.sizeY,
                    size: u.sizeInfo,
                    rotateY: ry
                });
            }
            else if (u.type === 'portal') {
                const portalEntry = { id: u.id, x: p.x, y: p.y, z: p.z, radius: u.sizeInfo };
                if (typeof u.subType === 'string' && u.subType) {
                    portalEntry.model = u.subType;
                }
                payload.portals.push(portalEntry);
            }
            else if (u.type === 'spawn') {
                if (u.subType === 'player') {
                    payload.playerSpawn = { id: u.id, x: p.x, y: p.y, z: p.z };
                } else {
                    payload.botSpawns.push({ id: u.id, x: p.x, y: p.y, z: p.z });
                }
            }
            else if (u.type === 'item') {
                payload.items.push({ id: u.id, type: u.subType, x: p.x, y: p.y, z: p.z, rotateY: ry });
            }
            else if (u.type === 'aircraft') {
                payload.aircraft.push({
                    id: u.id,
                    jetId: u.subType,
                    x: p.x, y: p.y, z: p.z,
                    scale: u.modelScale || 50,
                    rotateY: ry
                });
            }
            else if (u.type === 'tunnel') {
                if (u.pointA && u.pointB) {
                    const tunnelEntry = {
                        id: u.id,
                        ax: u.pointA.x, ay: u.pointA.y, az: u.pointA.z,
                        bx: u.pointB.x, by: u.pointB.y, bz: u.pointB.z,
                        radius: u.radius
                    };
                    if (typeof u.subType === 'string' && u.subType) {
                        tunnelEntry.model = u.subType;
                    }
                    payload.tunnels.push(tunnelEntry);
                }
            }
        });

        return JSON.stringify(payload, null, 2);
    }

    importFromJSON(jsonString, options = {}) {
        try {
            const parsed = parseMapJSON(jsonString);
            const data = parsed.map;
            const onArenaSize = typeof options === 'function'
                ? options
                : (typeof options?.onArenaSize === 'function' ? options.onArenaSize : null);

            if (parsed.warnings.length > 0) {
                console.warn('[EditorMapManager] Import migration warnings:', parsed.warnings);
            }

            if (data.arenaSize && onArenaSize) {
                onArenaSize(data.arenaSize);
            }

            this.clearAllObjects();

            this.withSceneMutation(() => {
                if (data.hardBlocks) {
                    data.hardBlocks.forEach((b) => this.createMesh('hard', null, b.x, b.y, b.z, b.size, {
                        id: b.id,
                        sizeX: b.width || b.size * 2,
                        sizeZ: b.depth || b.size * 2,
                        sizeY: b.height || b.size * 2,
                        rotateY: b.rotateY || 0
                    }, { updateUi: false }));
                }

                if (data.foamBlocks) {
                    data.foamBlocks.forEach((b) => this.createMesh('foam', null, b.x, b.y, b.z, b.size, {
                        id: b.id,
                        sizeX: b.width || b.size * 2,
                        sizeZ: b.depth || b.size * 2,
                        sizeY: b.height || b.size * 2,
                        rotateY: b.rotateY || 0
                    }, { updateUi: false }));
                }

                if (data.portals) {
                    data.portals.forEach((b) => this.createMesh('portal', b.model || null, b.x, b.y, b.z, b.radius, {
                        id: b.id
                    }, { updateUi: false }));
                }

                if (data.items) {
                    data.items.forEach((b) => this.createMesh('item', b.type, b.x, b.y, b.z, 0, {
                        id: b.id,
                        rotateY: b.rotateY || 0
                    }, { updateUi: false }));
                }

                if (data.aircraft) {
                    data.aircraft.forEach((a) => this.createMesh('aircraft', a.jetId, a.x, a.y, a.z, 0, {
                        id: a.id,
                        modelScale: a.scale || 50,
                        rotateY: a.rotateY || 0
                    }, { updateUi: false }));
                }

                if (data.botSpawns) {
                    data.botSpawns.forEach((b) => this.createMesh('spawn', 'bot', b.x, b.y, b.z, 0, {
                        id: b.id
                    }, { updateUi: false }));
                }

                if (data.playerSpawn) {
                    this.createMesh('spawn', 'player', data.playerSpawn.x, data.playerSpawn.y, data.playerSpawn.z, 0, {
                        id: data.playerSpawn.id
                    }, { updateUi: false });
                }

                if (data.tunnels) {
                    data.tunnels.forEach((t) => {
                        const pA = new THREE.Vector3(t.ax, t.ay, t.az);
                        const pB = new THREE.Vector3(t.bx, t.by, t.bz);
                        const center = pA.clone().lerp(pB, 0.5);
                        this.createMesh('tunnel', t.model || null, center.x, center.y, center.z, t.radius, {
                            id: t.id,
                            pointA: pA,
                            pointB: pB,
                            radius: t.radius
                        }, { updateUi: false });
                    });
                }

                this.queueSceneUiRefresh({ tunnelVisuals: true });
            });
        } catch (e) {
            console.error('[EditorMapManager] Map import failed:', e);
            alert("Map Import Error: " + e.message);
        }
    }
}
