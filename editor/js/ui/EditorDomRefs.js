export function createEditorDomRefs(doc = document) {
    return {
        toolButtons: Array.from(doc.querySelectorAll('.tool')),
        subMenus: Array.from(doc.querySelectorAll('.sub-menu')),

        subSpawn: doc.getElementById("subSpawn"),
        subTunnel: doc.getElementById("subTunnel"),
        subPortal: doc.getElementById("subPortal"),
        subItem: doc.getElementById("subItem"),
        subAircraft: doc.getElementById("subAircraft"),

        selSpawnType: doc.getElementById("selSpawnType"),
        selTunnelType: doc.getElementById("selTunnelType"),
        selPortalType: doc.getElementById("selPortalType"),
        selItemType: doc.getElementById("selItemType"),
        selAircraftType: doc.getElementById("selAircraftType"),

        chkFly: doc.getElementById("chkFly"),
        chkYLayer: doc.getElementById("chkYLayer"),
        numYLayer: doc.getElementById("numYLayer"),
        chkSnap: doc.getElementById("chkSnap"),
        numGrid: doc.getElementById("numGrid"),

        numArenaW: doc.getElementById("numArenaW"),
        numArenaD: doc.getElementById("numArenaD"),
        numArenaH: doc.getElementById("numArenaH"),

        hudObjCount: doc.getElementById("hudObjCount"),

        propPanel: doc.getElementById("propPanel"),
        propSizeRow: doc.getElementById("propSizeRow"),
        propWidthRow: doc.getElementById("propWidthRow"),
        propDepthRow: doc.getElementById("propDepthRow"),
        propHeightRow: doc.getElementById("propHeightRow"),
        propScaleRow: doc.getElementById("propScaleRow"),
        propY: doc.getElementById("propY"),
        propSize: doc.getElementById("propSize"),
        propWidth: doc.getElementById("propWidth"),
        propDepth: doc.getElementById("propDepth"),
        propHeight: doc.getElementById("propHeight"),
        propScale: doc.getElementById("propScale"),

        jsonOutput: doc.getElementById("jsonOutput"),
        btnSaveToGame: doc.getElementById("btnSaveToGame"),
        btnExport: doc.getElementById("btnExport"),
        btnPlaytest: doc.getElementById("btnPlaytest"),
        selPlaytestMode: doc.getElementById("selPlaytestMode"),
        btnImport: doc.getElementById("btnImport"),
        btnNew: doc.getElementById("btnNew"),
        btnDelSelected: doc.getElementById("btnDelSelected"),
        btnUndo: doc.getElementById("btnUndo"),
        btnRedo: doc.getElementById("btnRedo"),
    };
}
