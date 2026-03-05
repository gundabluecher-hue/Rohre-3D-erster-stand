const DEFAULT_FALLBACK_MAP_KEY = 'standard';

function resolveFallbackKeyFromMaps(maps) {
    if (maps?.[DEFAULT_FALLBACK_MAP_KEY]) {
        return DEFAULT_FALLBACK_MAP_KEY;
    }
    const mapKeys = Object.keys(maps || {});
    return mapKeys.length > 0 ? mapKeys[0] : DEFAULT_FALLBACK_MAP_KEY;
}

function resolveMapDefinition(maps, mapKey, fallbackMapKey) {
    return maps?.[mapKey] || maps?.[fallbackMapKey] || null;
}

export function resolveFallbackMapKey(maps) {
    return resolveFallbackKeyFromMaps(maps);
}

export function resolveKnownMapSelection({ requestedMapKey, maps, fallbackMapKey }) {
    const knownMap = maps?.[requestedMapKey] || null;
    if (knownMap) {
        return {
            requestedMapKey,
            effectiveMapKey: requestedMapKey,
            mapDefinition: knownMap,
            warnings: [],
            isFallback: false,
            isCustom: false,
            error: null,
        };
    }

    return {
        requestedMapKey,
        effectiveMapKey: fallbackMapKey,
        mapDefinition: resolveMapDefinition(maps, fallbackMapKey, fallbackMapKey),
        warnings: [`Unknown map key "${requestedMapKey}". Falling back to "${fallbackMapKey}".`],
        isFallback: true,
        isCustom: false,
        error: `Unknown map key "${requestedMapKey}".`,
    };
}

export function resolveCustomMapSelection({ requestedMapKey, maps, fallbackMapKey, customResult }) {
    if (customResult?.ok) {
        return {
            requestedMapKey,
            effectiveMapKey: requestedMapKey,
            mapDefinition: customResult.mapDefinition,
            mapDocument: customResult.mapDocument,
            warnings: customResult.warnings || [],
            isFallback: false,
            isCustom: true,
            error: null,
        };
    }

    return {
        requestedMapKey,
        effectiveMapKey: fallbackMapKey,
        mapDefinition: resolveMapDefinition(maps, fallbackMapKey, fallbackMapKey),
        warnings: customResult?.warnings || [],
        isFallback: true,
        isCustom: false,
        error: customResult?.error || 'Unknown custom map parsing error.',
    };
}

