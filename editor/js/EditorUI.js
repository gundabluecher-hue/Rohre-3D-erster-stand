import * as THREE from 'three';
import { EditorCommandHistory, SnapshotCommand } from './EditorCommandHistory.js';
import { bindEditorToolPaletteControls } from './ui/EditorToolPaletteControls.js';
import { bindEditorCanvasInteractionControls } from './ui/EditorCanvasInteractionControls.js';
import { bindEditorPropertyControls } from './ui/EditorPropertyControls.js';
import { bindEditorShortcutControls } from './ui/EditorShortcutControls.js';
import { bindEditorViewportControls } from './ui/EditorViewportControls.js';
import { bindEditorSessionControls } from './ui/EditorSessionControls.js';
import { createEditorDomRefs } from './ui/EditorDomRefs.js';
import {
    hidePropertyPanelView,
    showPropertyPanelView,
    updateHudCountView,
    updateTunnelVisualsView,
    updateUndoRedoButtonsView
} from './ui/EditorUiViews.js';

export class EditorUI {
    constructor(core) {
        this.core = core;
        this.mapManager = null; // Injected later

        this.currentTool = "select";
        this.selectedObject = null;
        this.clipboardData = null;
        this.syncArenaValues = null;

        this.useSnap = false;
        this.snapSize = 50;
        this.flyModeEnabled = false;
        this.ARENA_W = 2800;
        this.ARENA_D = 2400;
        this.ARENA_H = 950;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.isDrawing = false;
        this.drawStartPos = null;
        this.previewMesh = null;

        this.commandHistory = new EditorCommandHistory({
            limit: 100,
            onChange: (state) => this.updateUndoRedoUi(state)
        });
        this.historySuspendDepth = 0;
        this.pendingHistoryGestures = new Map();
        this.dom = createEditorDomRefs(document);

        this.core.setRuntimeStateAccessors?.({
            isFlyModeEnabled: () => this.flyModeEnabled,
            getArenaHeight: () => this.ARENA_H
        });

        this.setupVisuals();
        this.setupEventListeners();
    }

    setMapManager(mana) {
        this.mapManager = mana;
        this.updateUndoRedoUi();
    }

    detachTransformControl() {
        if (this.core.transformControl.object) {
            this.core.transformControl.detach();
        }
    }

    isManagedObjectAlive(object) {
        if (!object) return false;
        if (!this.mapManager) return object.parent === this.core.objectsContainer;
        return this.mapManager.isRegisteredObject(object);
    }

    clearDrawingState() {
        this.cancelHistoryGesture('draw');
        this.isDrawing = false;
        this.drawStartPos = null;
        this.previewMesh = null;
    }

    getArenaSizeForExport() {
        return {
            width: this.ARENA_W,
            height: this.ARENA_H,
            depth: this.ARENA_D
        };
    }

    setArenaSizeInputs(arenaSize) {
        if (!arenaSize) return;
        const { numArenaW, numArenaD, numArenaH } = this.dom;
        if (Number.isFinite(Number(arenaSize.width))) {
            if (numArenaW) numArenaW.value = arenaSize.width;
        }
        if (Number.isFinite(Number(arenaSize.depth))) {
            if (numArenaD) numArenaD.value = arenaSize.depth;
        }
        if (Number.isFinite(Number(arenaSize.height))) {
            if (numArenaH) numArenaH.value = arenaSize.height;
        }
    }

    isHistoryRecordingSuspended() {
        return this.historySuspendDepth > 0 || this.commandHistory?.isApplying?.();
    }

    withHistorySuspended(fn) {
        this.historySuspendDepth += 1;
        try {
            return fn();
        } finally {
            this.historySuspendDepth = Math.max(0, this.historySuspendDepth - 1);
        }
    }

    captureHistorySnapshot() {
        if (!this.mapManager) return null;

        let json = '';
        try {
            json = this.mapManager.generateJSONExport(this.getArenaSizeForExport());
        } catch (error) {
            console.warn('[EditorUI] Failed to capture history snapshot:', error);
            return null;
        }

        const selectedObjectId = (this.selectedObject && this.isManagedObjectAlive(this.selectedObject))
            ? (this.selectedObject.userData?.id || null)
            : null;
        const hasPlayerSpawnObject = this.core.objectsContainer.children.some((obj) => (
            obj?.userData?.type === 'spawn' && obj?.userData?.subType === 'player'
        ));

        return {
            json,
            selectedObjectId,
            hasPlayerSpawnObject
        };
    }

    applyHistorySnapshot(snapshot) {
        if (!snapshot || !this.mapManager) return;
        const syncArenaValues = this.syncArenaValues || (() => { });

        this.withHistorySuspended(() => {
            this.mapManager.importFromJSON(snapshot.json, {
                onArenaSize: (arenaSize) => {
                    this.setArenaSizeInputs(arenaSize);
                    syncArenaValues();
                }
            });
            if (snapshot.hasPlayerSpawnObject === false) {
                const playerSpawns = [...this.core.objectsContainer.children].filter((obj) => (
                    obj?.userData?.type === 'spawn' && obj?.userData?.subType === 'player'
                ));
                playerSpawns.forEach((obj) => this.mapManager.removeObject(obj));
            }
            const selected = snapshot.selectedObjectId ? this.mapManager.getObjectById(snapshot.selectedObjectId) : null;
            this.selectObject(selected || null);
        });
    }

    pushSnapshotHistoryCommand(label, beforeSnapshot, afterSnapshot) {
        if (!beforeSnapshot || !afterSnapshot) return false;
        if (
            beforeSnapshot.json === afterSnapshot.json &&
            beforeSnapshot.hasPlayerSpawnObject === afterSnapshot.hasPlayerSpawnObject
        ) {
            return false;
        }

        return this.commandHistory.push(new SnapshotCommand({
            label,
            before: beforeSnapshot,
            after: afterSnapshot,
            applySnapshot: (snapshot) => this.applyHistorySnapshot(snapshot)
        }));
    }

    executeHistoryMutation(label, mutateFn) {
        if (typeof mutateFn !== 'function') return undefined;
        if (!this.mapManager || this.isHistoryRecordingSuspended()) {
            return mutateFn();
        }

        const beforeSnapshot = this.captureHistorySnapshot();
        const result = mutateFn();
        const afterSnapshot = this.captureHistorySnapshot();
        this.pushSnapshotHistoryCommand(label, beforeSnapshot, afterSnapshot);
        return result;
    }

    beginHistoryGesture(key, label) {
        if (!key || !this.mapManager || this.isHistoryRecordingSuspended()) return;
        if (this.pendingHistoryGestures.has(key)) return;

        const snapshot = this.captureHistorySnapshot();
        if (!snapshot) return;

        this.pendingHistoryGestures.set(key, {
            label: String(label || 'Change'),
            before: snapshot
        });
    }

    commitHistoryGesture(key, labelOverride = null) {
        if (!key) return false;

        const pending = this.pendingHistoryGestures.get(key);
        if (!pending) return false;
        this.pendingHistoryGestures.delete(key);

        if (!this.mapManager || this.isHistoryRecordingSuspended()) return false;

        const afterSnapshot = this.captureHistorySnapshot();
        return this.pushSnapshotHistoryCommand(labelOverride || pending.label, pending.before, afterSnapshot);
    }

    cancelHistoryGesture(key) {
        if (!key) return;
        this.pendingHistoryGestures.delete(key);
    }

    undo() {
        if (!this.commandHistory) return false;
        try {
            return this.commandHistory.undo();
        } catch (error) {
            alert(`Undo fehlgeschlagen: ${error.message}`);
            return false;
        }
    }

    redo() {
        if (!this.commandHistory) return false;
        try {
            return this.commandHistory.redo();
        } catch (error) {
            alert(`Redo fehlgeschlagen: ${error.message}`);
            return false;
        }
    }

    updateUndoRedoUi(state = null) {
        updateUndoRedoButtonsView(this, state);
    }

    beforeManagedObjectsCleared() {
        this.cancelHistoryGesture('transform');
        this.clearDrawingState();
        this.selectObject(null);
        this.detachTransformControl();
    }

    onBeforeManagedObjectRemoved(object) {
        if (!object) return;

        if (this.previewMesh === object) {
            this.clearDrawingState();
        }

        if (this.selectedObject === object) {
            this.selectObject(null);
            return;
        }

        if (this.core.transformControl.object === object) {
            this.detachTransformControl();
        }
    }

    syncTransformControlAttachment() {
        const selected = this.isManagedObjectAlive(this.selectedObject) ? this.selectedObject : null;
        const flyMode = !!this.flyModeEnabled;

        if (!selected || flyMode) {
            this.detachTransformControl();
            return;
        }

        if (this.core.transformControl.object !== selected) {
            this.core.transformControl.attach(selected);
        }
    }

    setupVisuals() {
        // Arena Box Visual
        const wallGeo = new THREE.BoxGeometry(1, 1, 1);
        const wallMat = new THREE.MeshBasicMaterial({ color: 0x334155, wireframe: true, transparent: true, opacity: 0.1 });
        this.arenaBoxWall = new THREE.Mesh(wallGeo, wallMat);
        this.core.scene.add(this.arenaBoxWall);

        this.arenaBox = new THREE.BoxHelper(this.arenaBoxWall, 0x3b82f6);
        this.core.scene.add(this.arenaBox);

        this.matTunnelLine = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            linewidth: 2,
            transparent: true,
            opacity: 0.5
        });

        this.updateArenaVisual();
    }

    updateArenaVisual() {
        this.arenaBox.matrixAutoUpdate = false;
        const matrix = new THREE.Matrix4().makeScale(this.ARENA_W, this.ARENA_H, this.ARENA_D);
        matrix.setPosition(0, this.ARENA_H / 2, 0);
        this.arenaBox.matrix.copy(matrix);
        this.arenaBox.update();
    }

    updateTunnelVisuals() {
        updateTunnelVisualsView(this);
    }

    updateHudCount() {
        updateHudCountView(this);
    }

    getSelectionOutlines(object) {
        const outlines = [];
        if (!object) return outlines;
        object.traverse((child) => {
            if (child.userData?.isSelectionOutline && child.material) outlines.push(child);
        });
        return outlines;
    }

    setSelectionOutline(object, color = 0x000000, opacity = 0.2) {
        const outlines = this.getSelectionOutlines(object);
        outlines.forEach((outline) => {
            outline.material.color.setHex(color);
            outline.material.opacity = opacity;
            outline.material.transparent = true;
            outline.material.needsUpdate = true;
        });
    }

    resolveSelectableObject(hitObject) {
        if (!hitObject) return null;
        if (this.mapManager) {
            return this.mapManager.resolveManagedObject(hitObject);
        }

        let node = hitObject;
        while (node && node.parent && node.parent !== this.core.objectsContainer) {
            node = node.parent;
        }
        if (node && node.parent === this.core.objectsContainer) return node;
        return null;
    }

    createClipboardPayload(object) {
        const payload = {
            ...object.userData,
            sourcePos: object.position.clone(),
            rotateY: object.rotation.y || 0
        };
        delete payload.id;
        delete payload.editorObjectId;
        delete payload.editorManagedRoot;
        if (payload.pointA?.isVector3) payload.pointA = payload.pointA.clone();
        if (payload.pointB?.isVector3) payload.pointB = payload.pointB.clone();
        return payload;
    }

    deleteSelectedObject() {
        if (!this.selectedObject) return;
        if (!this.isManagedObjectAlive(this.selectedObject)) {
            this.selectObject(null);
            return;
        }
        if (this.mapManager) {
            this.executeHistoryMutation('Delete object', () => {
                this.mapManager.removeObject(this.selectedObject);
            });
            return;
        }

        const removed = this.selectedObject;
        this.core.objectsContainer.remove(removed);
        this.detachTransformControl();
        if (removed.userData.type === 'tunnel') this.updateTunnelVisuals();
        this.selectedObject = null;
        this.hidePropPanel();
        this.updateHudCount();
    }

    selectObject(obj) {
        const nextObject = this.mapManager ? this.mapManager.resolveManagedObject(obj) : obj;

        if (this.selectedObject && !this.isManagedObjectAlive(this.selectedObject)) {
            this.selectedObject = null;
        }

        if (this.selectedObject) {
            this.setSelectionOutline(this.selectedObject, 0x000000, 0.2);
        }

        this.selectedObject = nextObject && this.isManagedObjectAlive(nextObject) ? nextObject : null;

        if (this.selectedObject) {
            this.setSelectionOutline(this.selectedObject, 0xffffff, 0.8);
            this.syncTransformControlAttachment();
            this.showPropPanel(this.selectedObject);
        } else {
            this.detachTransformControl();
            this.hidePropPanel();
        }
    }

    clearAllObjects() {
        if (this.mapManager) {
            this.mapManager.clearAllObjects();
            return;
        }

        while (this.core.objectsContainer.children.length > 0) {
            this.core.objectsContainer.remove(this.core.objectsContainer.children[0]);
        }
        this.selectObject(null);
        this.updateTunnelVisuals();
        this.updateHudCount();
    }

    showPropPanel(obj) {
        showPropertyPanelView(this, obj);
    }

    hidePropPanel() {
        hidePropertyPanelView(this);
    }

    setupEventListeners() {
        this.flyModeEnabled = !!this.dom.chkFly?.checked;

        bindEditorToolPaletteControls(this);

        bindEditorCanvasInteractionControls(this);

        bindEditorShortcutControls(this);

        bindEditorPropertyControls(this);

        // Arena resize
        const syncArenaValues = () => {
            this.ARENA_W = parseFloat(this.dom.numArenaW?.value) || 2800;
            this.ARENA_D = parseFloat(this.dom.numArenaD?.value) || 2400;
            this.ARENA_H = parseFloat(this.dom.numArenaH?.value) || 950;
            this.updateArenaVisual();
        };
        this.syncArenaValues = syncArenaValues;

        bindEditorViewportControls(this, { syncArenaValues });
        bindEditorSessionControls(this, { syncArenaValues });

        this.updateUndoRedoUi();
    }
}

