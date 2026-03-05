import { CONFIG } from '../core/Config.js';
import {
    CUSTOM_MAP_KEY,
    CUSTOM_MAP_STORAGE_KEY,
    parseMapJSON,
    toArenaMapDefinition,
} from './MapSchema.js';
import {
    resolveCustomMapSelection,
    resolveFallbackMapKey,
    resolveKnownMapSelection,
} from './mapSchema/CustomMapSelectionResolver.js';

const LEGACY_EDITOR_PLAYTEST_SCALE = 35;
const LEGACY_EDITOR_LARGE_DIM_THRESHOLD = 500;

function getStorage(storageOverride) {
    if (storageOverride) return storageOverride;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function getRuntimeScale() {
    const scale = Number(CONFIG?.ARENA?.MAP_SCALE);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return scale;
}

function getCustomMapConversionScale(mapDocument) {
    const runtimeScale = getRuntimeScale();
    const width = Number(mapDocument?.arenaSize?.width);
    const height = Number(mapDocument?.arenaSize?.height);
    const depth = Number(mapDocument?.arenaSize?.depth);
    const maxDim = Math.max(
        Number.isFinite(width) ? width : 0,
        Number.isFinite(height) ? height : 0,
        Number.isFinite(depth) ? depth : 0
    );

    // The editor still uses legacy world-sized defaults (e.g. 2800x950x2400).
    // Those values become unplayably large with the current runtime MAP_SCALE=3
    // if we convert them 1:1. Detect these large editor-space maps and apply the
    // historical normalization factor used by the old pipeline.
    if (maxDim >= LEGACY_EDITOR_LARGE_DIM_THRESHOLD && runtimeScale < LEGACY_EDITOR_PLAYTEST_SCALE) {
        return {
            scale: LEGACY_EDITOR_PLAYTEST_SCALE,
            warning: `Large editor-scale map detected. Applied legacy playtest normalization (/${LEGACY_EDITOR_PLAYTEST_SCALE}).`,
        };
    }

    return {
        scale: runtimeScale,
        warning: null,
    };
}

export function loadCustomMapFromStorage(storageOverride) {
    const storage = getStorage(storageOverride);
    if (!storage) {
        return {
            ok: false,
            error: 'localStorage is not available.',
            warnings: [],
        };
    }

    let rawJSON = null;
    try {
        rawJSON = storage.getItem(CUSTOM_MAP_STORAGE_KEY);
    } catch (error) {
        return {
            ok: false,
            error: `Unable to read localStorage key "${CUSTOM_MAP_STORAGE_KEY}": ${error.message}`,
            warnings: [],
        };
    }

    if (!rawJSON) {
        return {
            ok: false,
            error: `No custom map found in localStorage key "${CUSTOM_MAP_STORAGE_KEY}".`,
            warnings: [],
        };
    }

    try {
        const parsed = parseMapJSON(rawJSON);
        const conversionScale = getCustomMapConversionScale(parsed.map);
        const converted = toArenaMapDefinition(parsed.map, {
            mapScale: conversionScale.scale,
            name: 'Custom (Editor gespeichert)',
        });
        return {
            ok: true,
            mapDocument: converted.mapDocument,
            mapDefinition: converted.map,
            warnings: [
                ...parsed.warnings,
                ...(conversionScale.warning ? [conversionScale.warning] : []),
                ...converted.warnings,
            ],
        };
    } catch (error) {
        console.error('[CustomMapLoader] Error parsing custom map:', error);
        return {
            ok: false,
            error: error.message || 'Unknown custom map parsing error.',
            warnings: [],
        };
    }
}

export function resolveArenaMapSelection(requestedMapKey, storageOverride) {
    const mapKey = String(requestedMapKey || '');
    const fallbackMapKey = resolveFallbackMapKey(CONFIG.MAPS);

    if (mapKey !== CUSTOM_MAP_KEY) {
        return resolveKnownMapSelection({
            requestedMapKey: mapKey,
            maps: CONFIG.MAPS,
            fallbackMapKey,
        });
    }

    const customResult = loadCustomMapFromStorage(storageOverride);

    const selection = resolveCustomMapSelection({
        requestedMapKey: mapKey,
        maps: CONFIG.MAPS,
        fallbackMapKey,
        customResult,
    });

    if (selection.isFallback) {
        console.warn(`[CustomMapLoader] Failed to load custom map, falling back to "${fallbackMapKey}". Error:`, selection.error);
    }

    return selection;
}
