export const MAP_SCHEMA_VERSION = 1;
export const CUSTOM_MAP_KEY = 'custom';
export const CUSTOM_MAP_STORAGE_KEY = 'custom_map_test';

const DEFAULT_ARENA_SIZE = Object.freeze({
    width: 2800,
    height: 950,
    depth: 2400,
});

const DEFAULT_PORTAL_COLORS = [0x00ffcc, 0xff66ff, 0x66ccff, 0xffaa00, 0x44ffaa, 0xff6688];

function asFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function asPositiveNumber(value, fallback, min = 0.001) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.max(min, parsed);
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function sanitizeOptionalId(value) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function withOptionalId(target, rawId) {
    const id = sanitizeOptionalId(rawId);
    if (id) target.id = id;
    return target;
}

function withOptionalStringField(target, key, value) {
    if (typeof key !== 'string' || key.length === 0) return target;
    if (typeof value !== 'string') return target;
    const normalized = value.trim();
    if (normalized.length > 0) {
        target[key] = normalized;
    }
    return target;
}

function sanitizeArenaSize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        width: asPositiveNumber(source.width, DEFAULT_ARENA_SIZE.width, 1),
        height: asPositiveNumber(source.height, DEFAULT_ARENA_SIZE.height, 1),
        depth: asPositiveNumber(source.depth, DEFAULT_ARENA_SIZE.depth, 1),
    };
}

function sanitizeVector3(raw, fallback) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalId({
        x: asFiniteNumber(source.x, fallback.x),
        y: asFiniteNumber(source.y, fallback.y),
        z: asFiniteNumber(source.z, fallback.z),
    }, source.id);
}

function sanitizeBlock(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const legacySize = asPositiveNumber(source.size, 140, 1);
    const width = asPositiveNumber(source.width, legacySize * 2, 1);
    const depth = asPositiveNumber(source.depth, legacySize * 2, 1);
    const height = asPositiveNumber(source.height, legacySize * 2, 1);
    return withOptionalId({
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        width,
        depth,
        height,
        size: asPositiveNumber(source.size, Math.max(width, depth, height) * 0.5, 1),
        rotateY: asFiniteNumber(source.rotateY, 0),
    }, source.id);
}

function sanitizeTunnel(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalStringField(withOptionalId({
        ax: asFiniteNumber(source.ax, 0),
        ay: asFiniteNumber(source.ay, 0),
        az: asFiniteNumber(source.az, 0),
        bx: asFiniteNumber(source.bx, 0),
        by: asFiniteNumber(source.by, 0),
        bz: asFiniteNumber(source.bz, 0),
        radius: asPositiveNumber(source.radius, 160, 1),
    }, source.id), 'model', source.model);
}

function sanitizePortal(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalStringField(withOptionalId({
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        radius: asPositiveNumber(source.radius, 80, 1),
    }, source.id), 'model', source.model);
}

function sanitizeItem(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalId({
        type: String(source.type || 'item_crystal'),
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        rotateY: asFiniteNumber(source.rotateY, 0),
    }, source.id);
}

function sanitizeAircraft(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalId({
        jetId: String(source.jetId || 'jet_ship5'),
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        scale: asPositiveNumber(source.scale, 50, 0.1),
        rotateY: asFiniteNumber(source.rotateY, 0),
    }, source.id);
}

function sanitizeLegacyRuntimeMapDocument(rawMap, warnings) {
    const runtimeSize = Array.isArray(rawMap?.size) ? rawMap.size : [];
    const width = asPositiveNumber(runtimeSize[0], DEFAULT_ARENA_SIZE.width, 1);
    const height = asPositiveNumber(runtimeSize[1], DEFAULT_ARENA_SIZE.height, 1);
    const depth = asPositiveNumber(runtimeSize[2], DEFAULT_ARENA_SIZE.depth, 1);

    const hardBlocks = [];
    for (const obstacle of asArray(rawMap?.obstacles)) {
        const pos = Array.isArray(obstacle?.pos) ? obstacle.pos : [0, 0, 0];
        const size = Array.isArray(obstacle?.size) ? obstacle.size : [2, 2, 2];
        const block = sanitizeBlock({
            x: pos[0],
            y: pos[1],
            z: pos[2],
            width: size[0],
            height: size[1],
            depth: size[2],
        });
        hardBlocks.push(block);
    }

    const portals = [];
    for (const pair of asArray(rawMap?.portals)) {
        if (!Array.isArray(pair?.a) || !Array.isArray(pair?.b)) {
            continue;
        }
        portals.push(sanitizePortal({ x: pair.a[0], y: pair.a[1], z: pair.a[2], radius: 80 }));
        portals.push(sanitizePortal({ x: pair.b[0], y: pair.b[1], z: pair.b[2], radius: 80 }));
    }

    warnings.push('Legacy runtime map format detected. Converted to editor schema v1.');

    return {
        schemaVersion: MAP_SCHEMA_VERSION,
        arenaSize: { width, height, depth },
        tunnels: [],
        hardBlocks,
        foamBlocks: [],
        portals,
        items: [],
        aircraft: [],
        botSpawns: [],
        playerSpawn: {
            x: -800,
            y: height * 0.55,
            z: 0,
        },
    };
}

function normalizeMapSchemaDocument(rawMap) {
    if (!rawMap || typeof rawMap !== 'object') {
        throw new Error('Map root must be an object.');
    }

    const arenaSize = sanitizeArenaSize(rawMap.arenaSize);
    const playerSpawnDefault = { x: -800, y: arenaSize.height * 0.55, z: 0 };

    return {
        schemaVersion: MAP_SCHEMA_VERSION,
        arenaSize,
        tunnels: asArray(rawMap.tunnels).map((entry) => sanitizeTunnel(entry)),
        hardBlocks: asArray(rawMap.hardBlocks).map((entry) => sanitizeBlock(entry)),
        foamBlocks: asArray(rawMap.foamBlocks).map((entry) => sanitizeBlock(entry)),
        portals: asArray(rawMap.portals).map((entry) => sanitizePortal(entry)),
        items: asArray(rawMap.items).map((entry) => sanitizeItem(entry)),
        aircraft: asArray(rawMap.aircraft).map((entry) => sanitizeAircraft(entry)),
        botSpawns: asArray(rawMap.botSpawns).map((entry) => sanitizeVector3(entry, { x: 0, y: playerSpawnDefault.y, z: 0 })),
        playerSpawn: sanitizeVector3(rawMap.playerSpawn, playerSpawnDefault),
    };
}

export function migrateMapDocument(rawMap) {
    if (!rawMap || typeof rawMap !== 'object') {
        throw new Error('Map data must be a JSON object.');
    }

    const warnings = [];
    const schemaVersionRaw = rawMap.schemaVersion;
    const hasSchemaVersion = Number.isFinite(Number(schemaVersionRaw));
    const schemaVersion = hasSchemaVersion ? Math.trunc(Number(schemaVersionRaw)) : 0;

    if (schemaVersion > MAP_SCHEMA_VERSION) {
        throw new Error(`Unsupported schemaVersion ${schemaVersion}. Supported: ${MAP_SCHEMA_VERSION}.`);
    }

    let migrated = rawMap;
    if (schemaVersion <= 0) {
        const looksLikeRuntimeMap = Array.isArray(rawMap.size) && Array.isArray(rawMap.obstacles);
        if (looksLikeRuntimeMap) {
            migrated = sanitizeLegacyRuntimeMapDocument(rawMap, warnings);
        } else {
            warnings.push('Legacy map format detected. Migrated to schema v1.');
            migrated = { ...rawMap, schemaVersion: MAP_SCHEMA_VERSION };
        }
    }

    const map = normalizeMapSchemaDocument(migrated);
    return {
        map,
        warnings,
    };
}

export function parseMapJSON(jsonText) {
    if (typeof jsonText !== 'string') {
        throw new Error('Map JSON must be a string.');
    }
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid JSON: ${error.message}`);
    }
    return migrateMapDocument(parsed);
}

export function createMapDocument(data = {}) {
    const normalized = normalizeMapSchemaDocument({
        schemaVersion: MAP_SCHEMA_VERSION,
        ...data,
    });
    return normalized;
}

export function stringifyMapDocument(data = {}, indent = 2) {
    return JSON.stringify(createMapDocument(data), null, indent);
}

export function toArenaMapDefinition(mapDocument, options = {}) {
    const normalized = createMapDocument(mapDocument);
    const mapScale = asPositiveNumber(options.mapScale, 1, 0.0001);
    const invScale = 1 / mapScale;
    const warnings = [];

    const obstacles = [];
    const pushBlockAsObstacle = (block, kind = 'hard') => {
        obstacles.push({
            pos: [
                block.x * invScale,
                block.y * invScale,
                block.z * invScale,
            ],
            size: [
                block.width * invScale,
                block.height * invScale,
                block.depth * invScale,
            ],
            kind,
        });
    };

    normalized.hardBlocks.forEach((block) => pushBlockAsObstacle(block, 'hard'));
    normalized.foamBlocks.forEach((block) => pushBlockAsObstacle(block, 'foam'));

    if (normalized.tunnels.length > 0) {
        warnings.push('Tunnels are currently ignored by the game runtime.');
    }
    if (normalized.items.length > 0) {
        warnings.push('Items are currently ignored by the game runtime.');
    }
    if (normalized.aircraft.length > 0) {
        warnings.push('Aircraft props are currently ignored by the game runtime.');
    }
    const defaultPlayerSpawn = {
        x: -800,
        y: normalized.arenaSize.height * 0.55,
        z: 0,
    };
    const hasCustomPlayerSpawn = !!normalized.playerSpawn && (
        Math.abs(normalized.playerSpawn.x - defaultPlayerSpawn.x) > 0.001 ||
        Math.abs(normalized.playerSpawn.y - defaultPlayerSpawn.y) > 0.001 ||
        Math.abs(normalized.playerSpawn.z - defaultPlayerSpawn.z) > 0.001 ||
        !!normalized.playerSpawn.id
    );
    if (normalized.botSpawns.length > 0 || hasCustomPlayerSpawn) {
        warnings.push('Custom spawn points are currently ignored by the game runtime.');
    }

    const portals = [];
    for (let i = 0; i < normalized.portals.length; i += 2) {
        const entryA = normalized.portals[i];
        const entryB = normalized.portals[i + 1];
        if (!entryA || !entryB) {
            warnings.push('Odd number of portal nodes found; the last portal node was ignored.');
            break;
        }

        const pairIndex = Math.floor(i / 2);
        portals.push({
            a: [entryA.x * invScale, entryA.y * invScale, entryA.z * invScale],
            b: [entryB.x * invScale, entryB.y * invScale, entryB.z * invScale],
            color: DEFAULT_PORTAL_COLORS[pairIndex % DEFAULT_PORTAL_COLORS.length],
        });
    }

    return {
        map: {
            name: String(options.name || 'Custom Map'),
            size: [
                normalized.arenaSize.width * invScale,
                normalized.arenaSize.height * invScale,
                normalized.arenaSize.depth * invScale,
            ],
            obstacles,
            portals,
        },
        warnings,
        mapDocument: normalized,
    };
}
