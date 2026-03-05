import { DEFAULT_ARENA_SIZE, MAP_SCHEMA_VERSION } from './MapSchemaConstants.js';

export function asFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function asPositiveNumber(value, fallback, min = 0.001) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.max(min, parsed);
}

export function asArray(value) {
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

export function sanitizeArenaSize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        width: asPositiveNumber(source.width, DEFAULT_ARENA_SIZE.width, 1),
        height: asPositiveNumber(source.height, DEFAULT_ARENA_SIZE.height, 1),
        depth: asPositiveNumber(source.depth, DEFAULT_ARENA_SIZE.depth, 1),
    };
}

export function sanitizeVector3(raw, fallback) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalId({
        x: asFiniteNumber(source.x, fallback.x),
        y: asFiniteNumber(source.y, fallback.y),
        z: asFiniteNumber(source.z, fallback.z),
    }, source.id);
}

export function sanitizeBlock(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const legacySize = asPositiveNumber(source.size, 140, 1);
    const width = asPositiveNumber(source.width, legacySize * 2, 1);
    const depth = asPositiveNumber(source.depth, legacySize * 2, 1);
    const height = asPositiveNumber(source.height, legacySize * 2, 1);
    const result = withOptionalId({
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        width,
        depth,
        height,
        size: asPositiveNumber(source.size, Math.max(width, depth, height) * 0.5, 1),
        rotateY: asFiniteNumber(source.rotateY, 0),
    }, source.id);

    if (source.tunnel && typeof source.tunnel === 'object') {
        result.tunnel = {
            radius: asPositiveNumber(source.tunnel.radius, Math.min(width, height, depth) * 0.3, 0.1),
            axis: source.tunnel.axis === 'x' || source.tunnel.axis === 'y' || source.tunnel.axis === 'z'
                ? source.tunnel.axis
                : 'z',
        };
    }

    return result;
}

export function sanitizeTunnel(raw) {
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

export function sanitizePortal(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalStringField(withOptionalId({
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        radius: asPositiveNumber(source.radius, 80, 1),
    }, source.id), 'model', source.model);
}

export function sanitizeItem(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return withOptionalId({
        type: String(source.type || 'item_crystal'),
        x: asFiniteNumber(source.x, 0),
        y: asFiniteNumber(source.y, 0),
        z: asFiniteNumber(source.z, 0),
        rotateY: asFiniteNumber(source.rotateY, 0),
    }, source.id);
}

export function sanitizeAircraft(raw) {
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

export function normalizeMapSchemaDocument(rawMap) {
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

