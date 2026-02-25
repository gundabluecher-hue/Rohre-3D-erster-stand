import { CUSTOM_MAP_STORAGE_KEY } from '../../../src/entities/MapSchema.js';
import { getJsonEditorText, setJsonEditorText } from './EditorFormState.js';

const LAST_DISK_MAP_NAME_STORAGE_KEY = 'editor_last_disk_map_name';
const DEFAULT_DISK_MAP_NAME = 'Editor Map';

function promptForDiskMapName() {
    let defaultName = DEFAULT_DISK_MAP_NAME;
    try {
        const stored = localStorage.getItem(LAST_DISK_MAP_NAME_STORAGE_KEY);
        if (typeof stored === 'string' && stored.trim()) {
            defaultName = stored.trim();
        }
    } catch {
        // localStorage may be unavailable in some environments
    }

    const input = window.prompt(
        'Name fuer die Map im Spieleordner (gleichnamiger Export aktualisiert die bestehende Map):',
        defaultName
    );

    if (input === null) return null;
    const name = input.trim();
    if (!name) {
        throw new Error('Bitte einen gueltigen Map-Namen eingeben.');
    }

    try {
        localStorage.setItem(LAST_DISK_MAP_NAME_STORAGE_KEY, name);
    } catch {
        // ignore persistence failures for the default prompt value
    }

    return name;
}

export function bindEditorSessionControls(editor, { syncArenaValues } = {}) {
    if (!editor) return;
    const dom = editor.dom;

    const generateCurrentMapJson = () => editor.mapManager.generateJSONExport(editor.getArenaSizeForExport());

    const saveCurrentMapToGameStorage = () => {
        const jsonText = generateCurrentMapJson();
        localStorage.setItem(CUSTOM_MAP_STORAGE_KEY, jsonText);
        return jsonText;
    };

    const saveCurrentMapToDisk = async (mapName) => {
        const jsonText = generateCurrentMapJson();
        const response = await fetch('/api/editor/save-map-disk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonText,
                mapName
            })
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }

        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || `HTTP ${response.status} while saving map to disk.`);
        }

        return { jsonText, payload };
    };

    dom.btnExport?.addEventListener("click", () => {
        setJsonEditorText(editor, generateCurrentMapJson());
    });

    dom.btnSaveToGame?.addEventListener("click", async () => {
        let requestedMapName = null;
        try {
            requestedMapName = promptForDiskMapName();
        } catch (error) {
            alert(`Map-Name ungueltig: ${error.message}`);
            return;
        }

        if (requestedMapName === null) {
            return;
        }

        try {
            const { jsonText, payload } = await saveCurrentMapToDisk(requestedMapName);
            setJsonEditorText(editor, jsonText);

            const warnings = Array.isArray(payload.warnings) && payload.warnings.length > 0
                ? `\nHinweise: ${payload.warnings.join(' | ')}`
                : '';
            const saveMode = payload.overwritten ? 'aktualisiert' : 'neu gespeichert';

            alert(
                `Map auf Festplatte ${saveMode}.\n` +
                `Map-Auswahl: ${payload.mapName} (${payload.mapKey})\n` +
                `Editor-Datei: ${payload.editorSchemaPath}\n` +
                `Runtime-Datei: ${payload.runtimeMapPath}\n` +
                `Registry: ${payload.generatedModulePath}\n` +
                `Spielseite neu laden, damit der Eintrag sichtbar ist.` +
                warnings
            );
        } catch (error) {
            alert(
                `Map konnte nicht auf Festplatte gespeichert werden: ${error.message}\n` +
                `Hinweis: Der Editor muss ueber den lokalen Vite-Server laufen (npm run dev).`
            );
        }
    });

    dom.btnPlaytest?.addEventListener("click", () => {
        try {
            saveCurrentMapToGameStorage();
        } catch (error) {
            alert(`Playtest konnte nicht gespeichert werden: ${error.message}`);
            return;
        }

        const playtestMode = String(dom.selPlaytestMode?.value || '3d').toLowerCase();
        const params = new URLSearchParams();
        params.set('playtest', '1');
        params.set('planar', playtestMode === 'planar' ? '1' : '0');
        const playtestUrl = `../index.html?${params.toString()}`;
        const playtestWindow = window.open(playtestUrl, "_blank");
        if (playtestWindow) {
            playtestWindow.focus?.();
            return;
        }

        // Popup blocker fallback: start playtest in the current tab instead of failing silently.
        window.location.href = playtestUrl;
    });

    dom.btnImport?.addEventListener("click", () => {
        const txt = getJsonEditorText(editor).trim();
        if (!txt) return;
        editor.executeHistoryMutation('Import map', () => {
            editor.mapManager.importFromJSON(txt, {
                onArenaSize: (arenaSize) => {
                    if (typeof editor.setArenaSizeInputs === 'function') {
                        editor.setArenaSizeInputs(arenaSize);
                    }
                    if (typeof syncArenaValues === 'function') {
                        syncArenaValues();
                    }
                }
            });
        });
    });

    dom.btnNew?.addEventListener("click", () => {
        editor.executeHistoryMutation('Clear map', () => {
            editor.clearAllObjects();
            setJsonEditorText(editor, "");
        });
    });

    dom.btnDelSelected?.addEventListener("click", () => {
        editor.deleteSelectedObject();
    });

    dom.btnUndo?.addEventListener("click", () => {
        editor.undo();
    });

    dom.btnRedo?.addEventListener("click", () => {
        editor.redo();
    });
}
