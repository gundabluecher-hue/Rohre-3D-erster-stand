export function bindEditorToolPaletteControls(editor) {
    if (!editor) return;
    const dom = editor.dom;

    dom.toolButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            dom.toolButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            editor.currentTool = btn.dataset.tool;

            dom.subMenus.forEach((menu) => {
                menu.style.display = 'none';
            });
            if (editor.currentTool === 'spawn' && dom.subSpawn) dom.subSpawn.style.display = "flex";
            if (editor.currentTool === 'tunnel' && dom.subTunnel) dom.subTunnel.style.display = "flex";
            if (editor.currentTool === 'portal' && dom.subPortal) dom.subPortal.style.display = "flex";
            if (editor.currentTool === 'item' && dom.subItem) dom.subItem.style.display = "flex";
            if (editor.currentTool === 'aircraft' && dom.subAircraft) dom.subAircraft.style.display = "flex";

            if (editor.currentTool !== 'select') editor.selectObject(null);
        });
    });
}
