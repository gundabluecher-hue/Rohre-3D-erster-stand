import * as THREE from 'three';

export function updateUndoRedoButtonsView(editor, state = null) {
    const historyState = state || editor.commandHistory?.getState?.();
    if (!historyState) return;

    const { btnUndo, btnRedo } = editor.dom;

    if (btnUndo) {
        btnUndo.disabled = !historyState.canUndo;
        btnUndo.title = historyState.undoLabel
            ? `Undo: ${historyState.undoLabel} (Strg+Z)`
            : 'Undo (Strg+Z)';
    }
    if (btnRedo) {
        btnRedo.disabled = !historyState.canRedo;
        btnRedo.title = historyState.redoLabel
            ? `Redo: ${historyState.redoLabel} (Strg+Y / Strg+Shift+Z)`
            : 'Redo (Strg+Y / Strg+Shift+Z)';
    }
}

export function updateHudCountView(editor) {
    const count = editor.mapManager?.getObjectCount?.() ?? editor.core.objectsContainer.children.length;
    if (editor.dom.hudObjCount) {
        editor.dom.hudObjCount.textContent = `Objekte: ${count}`;
    }
}

export function showPropertyPanelView(editor, obj) {
    if (!obj || !obj.userData) {
        hidePropertyPanelView(editor);
        return;
    }

    const {
        propPanel,
        propSizeRow,
        propWidthRow,
        propDepthRow,
        propHeightRow,
        propScaleRow,
        propSize,
        propWidth,
        propDepth,
        propHeight,
        propY,
        propScale
    } = editor.dom;

    if (!propPanel || !propY) {
        hidePropertyPanelView(editor);
        return;
    }

    propPanel.style.display = "block";
    propY.value = Math.round(obj.position.y);

    const u = obj.userData;

    if (propSizeRow) propSizeRow.style.display = "none";
    if (propWidthRow) propWidthRow.style.display = "none";
    if (propDepthRow) propDepthRow.style.display = "none";
    if (propHeightRow) propHeightRow.style.display = "none";
    if (propScaleRow) propScaleRow.style.display = "none";

    if (u.type === 'hard' || u.type === 'foam') {
        if (propWidthRow) propWidthRow.style.display = "flex";
        if (propDepthRow) propDepthRow.style.display = "flex";
        if (propHeightRow) propHeightRow.style.display = "flex";
        if (propWidth) propWidth.value = u.sizeX || u.sizeInfo * 2;
        if (propDepth) propDepth.value = u.sizeZ || u.sizeInfo * 2;
        if (propHeight) propHeight.value = u.sizeY || u.sizeInfo * 2;
    } else if (u.type === 'tunnel' || u.type === 'portal') {
        if (propSizeRow) propSizeRow.style.display = "flex";
        if (propSize) propSize.value = u.radius || u.sizeInfo;
    } else if (u.type === 'aircraft') {
        if (propScaleRow) propScaleRow.style.display = "flex";
        if (propScale) propScale.value = u.modelScale || 50;
    }
}

export function hidePropertyPanelView(editor) {
    if (editor.dom.propPanel) editor.dom.propPanel.style.display = "none";
}

export function updateTunnelVisualsView(editor) {
    while (editor.core.tunnelLines.children.length > 0) {
        const line = editor.core.tunnelLines.children[0];
        editor.core.tunnelLines.remove(line);
        line.geometry?.dispose?.();
    }

    editor.core.objectsContainer.children.forEach((obj) => {
        if (obj.userData.type !== 'tunnel') return;
        if (!obj.userData.pointA || !obj.userData.pointB) return;
        const geometry = new THREE.BufferGeometry().setFromPoints([obj.userData.pointA, obj.userData.pointB]);
        const line = new THREE.Line(geometry, editor.matTunnelLine);
        editor.core.tunnelLines.add(line);
    });
}
