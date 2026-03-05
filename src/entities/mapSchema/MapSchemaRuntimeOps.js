import { DEFAULT_PORTAL_COLORS } from './MapSchemaConstants.js';
import { asPositiveNumber } from './MapSchemaSanitizeOps.js';
import { createMapDocument } from './MapSchemaMigrationOps.js';

export function toArenaMapDefinition(mapDocument, options = {}) {
    const normalized = createMapDocument(mapDocument);
    const mapScale = asPositiveNumber(options.mapScale, 1, 0.0001);
    const invScale = 1 / mapScale;
    const warnings = [];

    const obstacles = [];
    const pushBlockAsObstacle = (block, kind = 'hard') => {
        const obstacle = {
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
        };
        if (block.tunnel && typeof block.tunnel === 'object') {
            obstacle.tunnel = {
                radius: asPositiveNumber(block.tunnel.radius, Math.min(block.width, block.height, block.depth) * 0.3, 0.1) * invScale,
                axis: block.tunnel.axis === 'x' || block.tunnel.axis === 'y' || block.tunnel.axis === 'z'
                    ? block.tunnel.axis
                    : 'z',
            };
        }
        obstacles.push(obstacle);
    };

    normalized.hardBlocks.forEach((block) => pushBlockAsObstacle(block, 'hard'));
    normalized.foamBlocks.forEach((block) => pushBlockAsObstacle(block, 'foam'));

    if (normalized.tunnels.length > 0) {
        warnings.push('Standalone tunnels[] entries are currently ignored by the game runtime.');
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

